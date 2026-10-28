"use client";
export function PrintTeacherReport() {
  return <button type="button" className="next-button" onClick={() => {
    document.body.classList.add("printing-teacher-report");
    const clear = () => document.body.classList.remove("printing-teacher-report");
    window.addEventListener("afterprint", clear, { once: true });
    try { window.print(); } finally { clear(); }
  }}>Imprimir reporte o guardar PDF</button>;
}
