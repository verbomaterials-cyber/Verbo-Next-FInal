"use client";

import { useRouter } from "next/navigation";
import { Field, Select } from "@/components/ui";

export function MetricsFilters({
  examTypes,
  students,
  selectedExamId,
  selectedStudentId,
}: {
  examTypes: { id: string; name: string }[];
  students: { id: string; fullName: string }[];
  selectedExamId: string;
  selectedStudentId: string;
}) {
  const router = useRouter();

  function navigate(examen: string, alumno: string) {
    const qs = new URLSearchParams();
    if (examen) qs.set("examen", examen);
    if (alumno) qs.set("alumno", alumno);
    router.push(`/admin/metricas?${qs.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-4">
      <Field label="Examen">
        <Select
          value={selectedExamId}
          onChange={(e) => navigate(e.target.value, selectedStudentId)}
          className="w-64"
        >
          <option value="">Elegir examen…</option>
          {examTypes.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Alumno">
        <Select
          value={selectedStudentId}
          onChange={(e) => navigate(selectedExamId, e.target.value)}
          className="w-64"
        >
          <option value="">Elegir alumno…</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.fullName}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}
