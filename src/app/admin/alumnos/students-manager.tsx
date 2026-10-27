"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  createEnrollment,
  createStudent,
  deleteEnrollment,
  deleteStudent,
  regenerateAccessCode,
  resetStudentPassword,
  updateEnrollment,
  updateStudent,
  notifyEnrollment,
} from "@/lib/admin/student-actions";
import {
  Badge,
  Button,
  Checkbox,
  ErrorNote,
  Field,
  Input,
  Modal,
  Select,
} from "@/components/ui";
import { Icon } from "@/components/icons";

type ExamTypeRow = {
  id: string;
  name: string;
  examVersions: { id: string; label: string; isPublished: boolean }[];
};

type EnrollmentRow = {
  id: string;
  examTypeId: string;
  examName: string;
  examSlug: string;
  accessCode: string;
  attemptsAllowed: number;
  attemptsUsed: number;
  isBlocked: boolean;
  unlockedVersions: string[];
};

type StudentRow = {
  id: string;
  fullName: string;
  email: string;
  teacherEmail: string | null;
  isActive: boolean;
  createdAt: string;
  attemptCount: number;
  enrollments: EnrollmentRow[];
};

export function StudentsManager({
  mode = "students",
  query,
  examFilter,
  examTypes,
  students,
}: {
  mode?: "students" | "access";
  query: string;
  examFilter: string;
  examTypes: ExamTypeRow[];
  students: StudentRow[];
}) {
  const router = useRouter();
  const [studentModal, setStudentModal] = useState<null | { editing?: StudentRow }>(null);
  const [accessModal, setAccessModal] = useState<StudentRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  function navigate(q: string, examen: string) {
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (examen) qs.set("examen", examen);
    router.push(`/admin/${mode === "access" ? "accesos" : "alumnos"}?${qs.toString()}`);
  }

  async function handleDelete(s: StudentRow) {
    if (
      !confirm(
        `¿Eliminar a ${s.fullName}? Se borrarán sus accesos, intentos y respuestas. Esta acción no se puede deshacer.`,
      )
    )
      return;
    const result = await deleteStudent(s.id);
    if (!result.ok) setError(result.error);
    else {
      setError(null);
      router.refresh();
    }
  }

  return (
    <div className="rise-in space-y-6 admin-directory">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{mode === "access" ? "Cada acceso, bajo control." : "Personas, antes que perfiles."}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {mode === "access" ? "Asigna exámenes, elige versiones, administra intentos y revoca permisos." : "Administra alumnos, contraseñas, profesores y el estado de cada cuenta."}
          </p>
        </div>
        {mode === "students" ? <Button onClick={() => setStudentModal({})}>+ Nuevo alumno</Button> : <Link href="/admin/alumnos" className="text-link">Gestionar alumnos<Icon name="arrow" size={16} /></Link>}
      </div>

      {mode === "access" && <div className="access-guide"><Icon name="lock" size={22} /><p>Selecciona <strong>Gestionar accesos</strong> junto a un alumno. Desde ahí puedes dar acceso, elegir simuladores, ampliar intentos, bloquear temporalmente o quitar el permiso. Sus resultados se conservan al quitar un acceso.</p></div>}

      <div className="flex flex-wrap gap-3">
        <Input
          type="search"
          placeholder="Buscar por nombre o email…"
          aria-label="Buscar alumnos por nombre o correo"
          defaultValue={query}
          className="w-64"
          onKeyDown={(e) => {
            if (e.key === "Enter") navigate((e.target as HTMLInputElement).value, examFilter);
          }}
        />
        <Select
          value={examFilter}
          onChange={(e) => navigate(query, e.target.value)}
          className="w-56"
          aria-label="Filtrar por examen"
        >
          <option value="">Todos los exámenes</option>
          {examTypes.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </Select>
      </div>

      <ErrorNote>{error}</ErrorNote>

      {students.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong px-8 py-12 text-center">
          <p className="text-sm text-ink-muted">
            {query || examFilter ? "Sin resultados con esos filtros." : "Aún no hay alumnos."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-muted">
                <th className="px-4 py-2.5 font-medium">Alumno</th>
                <th className="px-4 py-2.5 font-medium">Accesos</th>
                <th className="px-4 py-2.5 font-medium">Intentos</th>
                <th className="px-4 py-2.5 font-medium">Alta</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {students.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{s.fullName}</p>
                    <p className="text-xs text-ink-muted">{s.email}</p>
                    {!s.isActive && <Badge tone="warning">Cuenta suspendida</Badge>}
                    {s.teacherEmail && <p className="mt-1 text-xs text-ink-muted">Profesor: {s.teacherEmail}</p>}
                  </td>
                  <td className="px-4 py-3">
                    {s.enrollments.length === 0 ? (
                      <span className="text-xs text-ink-muted">sin accesos</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {s.enrollments.map((e) => (
                          <Badge key={e.id} tone={e.isBlocked ? "warning" : "brand"}>
                            {e.examName}
                            {e.isBlocked && " (bloqueado)"}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{s.attemptCount}</td>
                  <td className="px-4 py-3 text-ink-muted">{s.createdAt}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {s.enrollments.some((e) => e.examSlug === "toefl-ibt") && <Link href={`/admin/alumnos/${s.id}/progreso`} className="rounded-lg px-3 py-1.5 text-xs font-medium text-brand hover:bg-brand-soft">Progreso TOEFL</Link>}
                      <Button variant="outline" size="sm" onClick={() => setAccessModal(s)}>
                        Gestionar accesos
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setStudentModal({ editing: s })}>
                        Editar
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => handleDelete(s)}>
                        Eliminar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {studentModal && (
        <StudentForm editing={studentModal.editing} onClose={() => setStudentModal(null)} />
      )}

      {accessModal && (
        <AccessManager
          student={students.find((s) => s.id === accessModal.id) ?? accessModal}
          examTypes={examTypes}
          onClose={() => setAccessModal(null)}
        />
      )}
    </div>
  );
}

/* ───────────── Alta / edición de alumno ───────────── */

function StudentForm({ editing, onClose }: { editing?: StudentRow; onClose: () => void }) {
  const router = useRouter();
  const [fullName, setFullName] = useState(editing?.fullName ?? "");
  const [email, setEmail] = useState(editing?.email ?? "");
  const [teacherEmail, setTeacherEmail] = useState(editing?.teacherEmail ?? "");
  const [isActive, setIsActive] = useState(editing?.isActive ?? true);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [newPassword, setNewPassword] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    if (editing) {
      const result = await updateStudent(editing.id, { fullName, email, teacherEmail, isActive });
      if (!result.ok) {
        setError(result.error);
        setSaving(false);
        return;
      }
      router.refresh();
      onClose();
      return;
    }

    const result = await createStudent({ fullName, email, password, teacherEmail });
    if (!result.ok) {
      setError(result.error);
      setSaving(false);
      return;
    }
    setNewPassword(result.data!.password);
    setSaving(false);
    router.refresh();
  }

  async function handleResetPassword() {
    if (!editing) return;
    const label = password
      ? `¿Asignar la nueva contraseña a ${editing.fullName}?`
      : `¿Generar una contraseña automática nueva para ${editing.fullName}?`;
    if (!confirm(`${label} La anterior dejará de funcionar.`)) return;
    const result = await resetStudentPassword(editing.id, password || undefined);
    if (!result.ok) setError(result.error);
    else setNewPassword(result.data!.password);
  }

  return (
    <Modal open onClose={onClose} title={editing ? "Editar alumno" : "Nuevo alumno"}>
      {newPassword ? (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed">
            Credenciales de <strong>{fullName}</strong> — compártelas ahora, la
            contraseña no se volverá a mostrar:
          </p>
          <div className="rounded-lg border border-line bg-background p-4 font-mono text-sm">
            <p>{email}</p>
            <p className="mt-1 text-lg font-semibold tracking-wide">{newPassword}</p>
          </div>
          <div className="flex flex-wrap gap-3"><Button onClick={onClose}>Listo</Button>{!editing && <Button variant="outline" onClick={() => { onClose(); router.push(`/admin/accesos?q=${encodeURIComponent(email)}`); }}>Asignar exámenes</Button>}</div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Nombre completo">
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </Field>
          <Field label="Email" help="Es su usuario para iniciar sesión.">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="Correo del profesor (opcional)" help="Recibe avisos cuando este alumno completa una simulación. El correo no crea una cuenta de profesor."><Input type="email" value={teacherEmail} onChange={e => setTeacherEmail(e.target.value)} /></Field>
          {editing && <Checkbox label="Cuenta activa" checked={isActive} onChange={e => setIsActive(e.target.checked)} />}
          {editing && !isActive && <p className="text-sm text-ink-muted">La suspensión cierra sus sesiones e impide entrar; conserva sus respuestas y resultados.</p>}
          <Field
            label={editing ? "Nueva contraseña (opcional)" : "Contraseña"}
            help={
              editing
                ? "Escribe una contraseña para fijarla al presionar “Restablecer”, o déjala vacía y se genera una automática."
                : "Tú decides la contraseña del alumno — no hay forma de que él la cambie. Déjala vacía para generar una automática."
            }
          >
            <Input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={editing ? "Dejar vacío = automática" : "Ej. verbo2026 (mín. 6 caracteres)"}
              minLength={6}
            />
          </Field>
          <ErrorNote>{error}</ErrorNote>
          <div className="flex flex-wrap gap-3 pt-1">
            <Button type="submit" disabled={saving || !fullName || !email}>
              {saving ? "Guardando…" : editing ? "Guardar" : "Crear alumno"}
            </Button>
            {editing && (
              <Button type="button" variant="outline" onClick={handleResetPassword}>
                Restablecer contraseña
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

/* ───────────── Gestión de accesos por alumno ───────────── */

function AccessManager({
  student,
  examTypes,
  onClose,
}: {
  student: StudentRow;
  examTypes: ExamTypeRow[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [newExamId, setNewExamId] = useState("");
  const [newAttempts, setNewAttempts] = useState("4");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [newVersions, setNewVersions] = useState<string[]>([]);

  const availableExams = examTypes.filter(
    (e) => !student.enrollments.some((en) => en.examTypeId === e.id),
  );

  async function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    setError(null);
    try {
      const result = await action();
      if (!result.ok) setError(result.error ?? "No se pudo guardar.");
      router.refresh();
    } catch { setError("No se pudo conectar. Reintenta la operación."); }
    finally { setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} wide title={`Accesos — ${student.fullName}`}>
      <div className="space-y-5">
        <ErrorNote>{error}</ErrorNote>
        {notice && <p role="status" className="access-guide">{notice}</p>}

        {student.enrollments.length === 0 && (
          <p className="text-sm text-ink-muted">Este alumno no tiene accesos todavía.</p>
        )}

        {student.enrollments.map((e) => {
          const exam = examTypes.find((x) => x.id === e.examTypeId);
          return (
            <div key={e.id} className="rounded-lg border border-line bg-background p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <h3 className="font-medium">{e.examName}</h3>
                  {e.isBlocked && <Badge tone="warning">bloqueado</Badge>}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" disabled={busy || e.isBlocked || !student.isActive} onClick={() => run(async () => { const result = await notifyEnrollment(e.id); if (result.ok) setNotice("Aviso en cola. Consulta su estado en Correos."); return result; })}>Enviar accesos por correo</Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => run(() => updateEnrollment(e.id, { isBlocked: !e.isBlocked }))}
                  >
                    {e.isBlocked ? "Desbloquear" : "Bloquear"}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      if (confirm(`¿Quitar el acceso a ${e.examName}?`))
                        run(() => deleteEnrollment(e.id));
                    }}
                  >
                    Quitar
                  </Button>
                </div>
              </div>

              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium text-ink-muted">Código de acceso</p>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="rounded bg-surface px-2 py-1 font-mono text-sm tracking-wider">
                      {e.accessCode}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigator.clipboard.writeText(e.accessCode)}
                    >
                      Copiar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => {
                        if (confirm("¿Regenerar el código? El anterior dejará de funcionar."))
                          run(() => regenerateAccessCode(e.id));
                      }}
                    >
                      Regenerar
                    </Button>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-ink-muted">
                    Intentos: {e.attemptsUsed} usados de
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <Input
                      type="number"
                      min={Math.max(1, e.attemptsUsed)}
                      defaultValue={e.attemptsAllowed}
                      disabled={busy}
                      className="w-20"
                      onBlur={(ev) => {
                        const value = Number(ev.target.value);
                        if (value !== e.attemptsAllowed && value >= 1)
                          run(() => updateEnrollment(e.id, { attemptsAllowed: value }));
                      }}
                      aria-label="Intentos permitidos"
                    />
                    <span className="text-xs text-ink-muted">permitidos</span>
                  </div>
                </div>
              </div>

              {exam && exam.examVersions.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-ink-muted">Versiones desbloqueadas</p>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1.5">
                    {exam.examVersions.map((v) => (
                      <Checkbox
                        key={v.id}
                        label={`${v.label}${v.isPublished ? "" : " (borrador)"}`}
                        checked={e.unlockedVersions.includes(v.id)}
                        disabled={busy || !v.isPublished}
                        onChange={(ev) =>
                          run(() =>
                            updateEnrollment(e.id, {
                              unlockedVersions: ev.target.checked
                                ? [...e.unlockedVersions, v.id]
                                : e.unlockedVersions.filter((x) => x !== v.id),
                            }),
                          )
                        }
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {availableExams.length > 0 && (
          <div className="rounded-lg border border-dashed border-line-strong p-4">
            <p className="mb-2.5 text-sm font-medium">Dar acceso a otro examen</p>
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Examen">
                <Select
                  value={newExamId}
                  onChange={(e) => { setNewExamId(e.target.value); setNewVersions(examTypes.find(x => x.id === e.target.value)?.examVersions.filter(v => v.isPublished).map(v => v.id) ?? []); }}
                  className="w-56"
                >
                  <option value="">Elegir…</option>
                  {availableExams.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Intentos permitidos">
                <Input
                  type="number"
                  min={1}
                  value={newAttempts}
                  onChange={(e) => setNewAttempts(e.target.value)}
                  className="w-24"
                />
              </Field>
              <Button
                disabled={busy || !newExamId}
                onClick={() =>
                  run(() =>
                    createEnrollment({
                      studentId: student.id,
                      examTypeId: newExamId,
                      attemptsAllowed: Number(newAttempts) || 1,
                      unlockedVersions: newVersions,
                    }),
                  ).then(() => setNewExamId(""))
                }
              >
                Dar acceso
              </Button>
            </div>
            {newExamId && <div className="mt-4 space-y-2"><p className="text-xs text-ink-muted">Simuladores que se habilitarán</p>{examTypes.find(x => x.id === newExamId)?.examVersions.filter(v => v.isPublished).map(v => <Checkbox key={v.id} label={v.label} checked={newVersions.includes(v.id)} onChange={e => setNewVersions(e.target.checked ? [...newVersions, v.id] : newVersions.filter(id => id !== v.id))} />)}</div>}
            <p className="mt-2 text-xs text-ink-muted">
              Se genera un código único y solo se habilitan las versiones seleccionadas.
            </p>
          </div>
        )}

        <div className="pt-1">
          <Button variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
