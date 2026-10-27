export function roleHome(role: string) { return role === "ADMIN" ? "/admin" : role === "TEACHER" ? "/profesor" : "/alumno"; }
export function safeCallbackPath(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") && !/[\\\u0000-\u001f]/.test(value) ? value : "/alumno";
}
export function practiceScore(score: unknown, status: string): { value: string; label: string } | null {
  if (status !== "COMPLETED" || !score || typeof score !== "object") return null;
  const s = score as { value?: unknown; scoringVersion?: unknown };
  if (typeof s.value !== "number" || !Number.isFinite(s.value)) return null;
  if (s.scoringVersion === "verbo-det-practice-v1" && s.value >= 0 && s.value <= 100) return { value: `${s.value}`, label: "Índice de práctica / 100" };
  if (s.scoringVersion === "verbo-toefl-practice-v1" && s.value >= 1 && s.value <= 6) return { value: s.value.toFixed(1), label: "Banda de práctica / 6" };
  return null;
}
export function portalDate(value: Date, includeYear = false) {
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", ...(includeYear ? { year: "numeric" } : {}), timeZone: "America/Mexico_City" }).format(value);
}
