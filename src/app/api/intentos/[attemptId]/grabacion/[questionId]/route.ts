import { Prisma } from "@prisma/client";
import { getAppSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { activeAttempt, AttemptError, writeAnswer } from "@/lib/student/attempt-service";

export const runtime = "nodejs";
// Leave room below Vercel's 4.5 MB request limit.
const MAX_BYTES = 4 * 1024 * 1024;
type Context = { params: Promise<{ attemptId: string; questionId: string }> };

function audioFormat(bytes: Uint8Array): string | null {
  const header = Buffer.from(bytes.subarray(0, 12));
  if (header.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return "audio/webm";
  if (header.toString("ascii", 0, 4) === "OggS") return "audio/ogg";
  if (header.toString("ascii", 4, 8) === "ftyp") return "audio/mp4";
  if (header.toString("ascii", 0, 4) === "RIFF" && header.toString("ascii", 8, 12) === "WAVE") return "audio/wav";
  return null;
}

export async function POST(request: Request, { params }: Context) {
  const session = await getAppSession();
  if (!session || session.user.role !== "STUDENT") return Response.json({ error: "No autorizado." }, { status: 401 });
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== request.headers.get("host")) return Response.json({ error: "Origen no permitido." }, { status: 403 });
    } catch { return Response.json({ error: "Origen no permitido." }, { status: 403 }); }
  }
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BYTES) {
    return Response.json({ error: "La grabación supera 4 MB." }, { status: 413 });
  }
  const { attemptId, questionId } = await params;
  const durationSeconds = Number(request.headers.get("x-duration-seconds"));
  if (!Number.isInteger(durationSeconds) || durationSeconds < 0 || durationSeconds > 600 || !request.body) {
    return Response.json({ error: "Grabación inválida." }, { status: 400 });
  }
  try {
    // Reject unauthorized attempts before receiving the recording body.
    const owned = await prisma.attempt.findFirst({ where: { id: attemptId, studentId: session.user.id, status: "IN_PROGRESS" }, select: { id: true } });
    if (!owned) return Response.json({ error: "Intento no disponible." }, { status: 403 });
    const chunks: Uint8Array[] = [];
    let length = 0;
    const reader = request.body.getReader();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BYTES) {
        await reader.cancel();
        return Response.json({ error: "La grabación supera 4 MB." }, { status: 413 });
      }
      chunks.push(value);
    }
    const content = Buffer.concat(chunks);
    const mimeType = audioFormat(content);
    if (!mimeType) return Response.json({ error: "Formato de audio no compatible." }, { status: 415 });
    const recording = await prisma.$transaction(async (tx) => {
      const { state, questions, attempt } = await activeAttempt(tx, attemptId, session.user.id);
      const question = questions[state.index];
      if (state.finished || state.phase !== "answer" || question.id !== questionId || question.questionType.responseType !== "AUDIO_RECORDING") {
        throw new AttemptError("La pregunta de speaking ya no está activa.");
      }
      if (Date.now() > state.deadlineAt + 15_000) throw new AttemptError("El tiempo de grabación terminó.");
      if (durationSeconds > (question.questionType.timePerItemSeconds ?? 90) + 1) {
        throw new AttemptError("La duración excede el tiempo de respuesta.");
      }
      const recorded = await tx.recording.upsert({
        where: { attemptId_questionId: { attemptId, questionId } },
        create: { attemptId, questionId, content: new Uint8Array(content), mimeType, durationSeconds },
        update: { content: new Uint8Array(content), mimeType, durationSeconds },
        select: { id: true },
      });
      const answer = { recorded: true, recordingId: recorded.id, durationSeconds,
        audioUrl: `/api/intentos/${attemptId}/grabacion/${questionId}` };
      await writeAnswer(tx, attemptId, questionId, answer,
        attempt.responses.find((r) => r.questionId === questionId)?.isFlagged ?? false);
      return answer;
    }, { timeout: 15_000 });
    return Response.json(recording, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AttemptError) return Response.json({ error: error.message }, { status: 409 });
    console.error("recording upload", error instanceof Prisma.PrismaClientKnownRequestError ? error.code : "storage failure");
    return Response.json({ error: "No se pudo guardar el audio. Puedes reintentar la subida." }, { status: 503 });
  }
}

export async function GET(_request: Request, { params }: Context) {
  const session = await getAppSession();
  if (!session) return new Response(null, { status: 401 });
  const { attemptId, questionId } = await params;
  const allowed = await prisma.attempt.findFirst({
    where: { id: attemptId, ...(session.user.role === "ADMIN" ? {} : session.user.role === "TEACHER" ? { student: { teacherId: session.user.id }, status: { not: "IN_PROGRESS" } } : { studentId: session.user.id }) },
    select: { id: true },
  });
  if (!allowed) return new Response(null, { status: 404 });
  const recording = await prisma.recording.findUnique({ where: { attemptId_questionId: { attemptId, questionId } } });
  if (!recording) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(recording.content), {
    headers: { "Content-Type": recording.mimeType, "Content-Length": String(recording.content.byteLength),
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
