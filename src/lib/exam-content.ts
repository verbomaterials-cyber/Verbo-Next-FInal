import { unstable_cache } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { optimizedMedia } from "./media";

export const EXAM_CONTENT_TAG = "exam-content-v1";

// Only shared authoring content is cached. Accounts, enrollments, responses,
// clocks, quotas and teacher assignments always come from current database rows.
// Use the caller's transaction on a miss so a one-connection pool cannot deadlock.
export function loadExamContent(versionId: string, client: Pick<Prisma.TransactionClient, "examVersion"> = prisma) {
  return unstable_cache(async () => {
    const version = await client.examVersion.findUniqueOrThrow({
      where: { id: versionId },
      include: {
        examType: true,
        questions: { orderBy: { order: "asc" }, include: { questionType: { include: { section: true } } } },
      },
    });
    return { ...version, questions: version.questions.map(q => ({ ...q, promptContent: optimizedMedia(q.promptContent) })) };
  }, ["exam-content-v1", versionId], { tags: [EXAM_CONTENT_TAG], revalidate: 3600 })();
}
