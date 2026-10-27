"use client";

/*
 * <SectionProgressStepper> — protagonista de los exámenes con orden fijo.
 * "hairline" (TOEFL): peso editorial, líneas finas y etiquetas serif;
 * es el elemento ancla arriba de la pantalla, no una barra de progreso.
 * "dots": variante compacta y neutra para otros exámenes con secciones.
 */
export function SectionProgressStepper({
  sections,
  activeIndex,
  style = "hairline",
  serif = false,
}: {
  sections: string[];
  activeIndex: number;
  style?: "hairline" | "dots";
  serif?: boolean;
}) {
  if (style === "dots") {
    return (
      <ol className="flex items-center justify-center gap-2.5" aria-label="Progreso de secciones">
        {sections.map((name, i) => {
          const done = i < activeIndex;
          const active = i === activeIndex;
          return (
            <li key={name} className="flex items-center gap-1.5" aria-current={active ? "step" : undefined}>
              <span
                className="rounded-full transition-all"
                style={{
                  width: active ? 9 : 7,
                  height: active ? 9 : 7,
                  backgroundColor: active || done ? "var(--xaccent2)" : "var(--xmuted)",
                  opacity: active ? 1 : done ? 0.75 : 0.3,
                }}
              />
            </li>
          );
        })}
      </ol>
    );
  }

  // hairline (editorial)
  return (
    <ol className="flex items-stretch justify-center" aria-label="Progreso de secciones">
      {sections.map((name, i) => {
        const done = i < activeIndex;
        const active = i === activeIndex;
        const reached = done || active;
        return (
          <li key={name} className="flex flex-1 items-center" style={{ maxWidth: 220 }}>
            {i > 0 && (
              <span
                aria-hidden
                className="h-px flex-1"
                style={{ backgroundColor: reached ? "var(--xaccent)" : "var(--xline)" }}
              />
            )}
            <div
              className="flex flex-col items-center gap-2 px-3"
              aria-current={active ? "step" : undefined}
            >
              <span
                aria-hidden
                className="flex items-center justify-center rounded-full text-[0.72rem] font-semibold transition-colors"
                style={{
                  width: 28,
                  height: 28,
                  fontFamily: "var(--xfont-body)",
                  border: `1px solid ${reached ? "var(--xaccent)" : "var(--xline)"}`,
                  backgroundColor: active ? "var(--xaccent)" : "transparent",
                  color: active ? "var(--xon-accent)" : done ? "var(--xaccent)" : "var(--xmuted)",
                }}
              >
                {done ? "✓" : i + 1}
              </span>
              <span
                className="text-center text-[0.82rem] leading-tight"
                style={{
                  fontFamily: serif ? "var(--xfont-display)" : "var(--xfont-body)",
                  fontStyle: serif ? "italic" : "normal",
                  color: reached ? "var(--xink)" : "var(--xmuted)",
                  fontWeight: active ? 600 : 400,
                }}
              >
                {name}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
