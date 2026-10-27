import type { AdminField, AdminFieldSchema } from "../exam-config";

function publicFields(fields: AdminField[]): AdminField[] {
  return fields.filter((f) => f.target === "prompt" && !f.studentHidden).map((f) => ({
    ...f,
    ...(f.itemFields ? { itemFields: publicFields(f.itemFields) } : {}),
  }));
}

/** Project by the public schema rather than sending the database JSON verbatim. */
export function studentQuestionPayload(
  schema: AdminFieldSchema,
  prompt: Record<string, unknown>,
  responseType: string,
): { schema: AdminFieldSchema; prompt: Record<string, unknown> } {
  const fields = publicFields(schema.fields);
  const output: Record<string, unknown> = {};
  for (const field of fields) {
    const value = prompt[field.key];
    if (value === undefined) continue;
    if (field.type === "repeater" && Array.isArray(value)) {
      output[field.key] = value.map((item) => studentQuestionPayload(
        { version: 1, fields: field.itemFields ?? [] },
        item as Record<string, unknown>,
        responseType,
      ).prompt);
    } else if (field.type === "options" && value && typeof value === "object" && !Array.isArray(value)) {
      output[field.key] = { options: (value as { options?: unknown }).options ?? [] };
    } else if (responseType === "FILL_BLANK" && typeof value === "string" &&
      (field.type === "text" || field.type === "textarea")) {
      output[field.key] = value.replace(/\[([^\]]+)\]/g, (_, answer: string) => `[${"_".repeat(answer.length)}]`);
    } else {
      output[field.key] = value;
    }
  }
  return { schema: { version: 1, fields, ...(schema.timingGroup ? { timingGroup: schema.timingGroup } : {}) }, prompt: output };
}
