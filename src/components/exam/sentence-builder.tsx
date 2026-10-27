"use client";

export function SentenceBuilder({ words, slots, value, onChange }: {
  words: string[];
  slots: number;
  value: number[];
  onChange: (order: number[]) => void;
}) {
  function place(word: number, position = value.length) {
    if (!Number.isInteger(word) || word < 0 || word >= words.length) return;
    const next = value.filter((index) => index !== word);
    next.splice(Math.min(position, next.length), 0, word);
    if (next.length <= slots) onChange(next);
  }
  return (
    <div className="space-y-7">
      <p className="text-sm leading-relaxed" style={{ color: "var(--xmuted)" }}>
        Move the words to build a complete sentence. You can drag them or select them in order.
      </p>
      <div className="flex min-h-28 flex-wrap items-start gap-2 rounded-lg border border-dashed p-4"
        style={{ borderColor: "var(--xline)" }} role="group" aria-label="Your sentence">
        {Array.from({ length: slots }, (_, position) => {
          const index = value[position];
          return <div key={position} className="min-w-20 flex-1"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => { event.preventDefault(); place(Number(event.dataTransfer.getData("text/plain")), position); }}>
            {index === undefined ? (
              <span className="block min-h-11 border-b-2 px-3 py-2 text-center text-sm" style={{ borderColor: "var(--xline)", color: "var(--xmuted)" }}>
                {position + 1}
              </span>
            ) : (
              <button type="button" draggable
                onDragStart={(event) => event.dataTransfer.setData("text/plain", String(index))}
                onClick={() => onChange(value.filter((_, i) => i !== position))}
                aria-label={`Remove ${words[index]} from position ${position + 1}`}
                className="min-h-11 w-full rounded-md border px-3 py-2 text-sm font-medium shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ borderColor: "var(--xaccent)", color: "var(--xink)", background: "var(--xsurface)" }}>
                {words[index]}
              </button>
            )}
          </div>;
        })}
      </div>
      <div role="group" aria-label="Word bank" className="flex flex-wrap justify-center gap-2">
        {words.map((word, index) => <button key={index} type="button" draggable={!value.includes(index)}
          onDragStart={(event) => event.dataTransfer.setData("text/plain", String(index))}
          onClick={() => place(index)} disabled={value.includes(index) || value.length >= slots}
          className="min-h-11 rounded-md border px-4 py-2 text-base shadow-sm transition-colors hover:border-(--xaccent) disabled:opacity-25 focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ borderColor: "var(--xline)", background: "var(--xsurface)", color: "var(--xink)" }}>
          {word}
        </button>)}
      </div>
      <div className="flex items-center justify-between text-xs" style={{ color: "var(--xmuted)" }}>
        <p role="status">{value.length} of {slots} word groups placed</p>
        <button type="button" onClick={() => onChange([])} className="rounded px-3 py-2 underline underline-offset-4" disabled={!value.length}>Clear sentence</button>
      </div>
    </div>
  );
}
