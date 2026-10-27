"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui";

const TABS = [
  { segment: "estructura", label: "Estructura" },
  { segment: "preguntas", label: "Preguntas" },
  { segment: "versiones", label: "Versiones" },
];

export function ExamTabs({ slug }: { slug: string }) {
  const pathname = usePathname();

  return (
    <nav className="mt-6 flex gap-1 border-b border-line" aria-label="Secciones del examen">
      {TABS.map((tab) => {
        const href = `/admin/examenes/${slug}/${tab.segment}`;
        const active = pathname.startsWith(href);
        return (
          <Link
            key={tab.segment}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors duration-150",
              active
                ? "border-brand text-brand"
                : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
