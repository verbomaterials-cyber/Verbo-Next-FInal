"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui";

const LINKS = [
  { href: "/admin", label: "Exámenes", exact: false },
  { href: "/admin/alumnos", label: "Alumnos", exact: true },
  { href: "/admin/metricas", label: "Métricas", exact: true },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1" aria-label="Navegación del panel">
      {LINKS.map((link) => {
        const active = link.exact
          ? pathname.startsWith(link.href)
          : pathname === link.href || pathname.startsWith("/admin/examenes");
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-[background-color,color] duration-150 ease-(--ease-out)",
              active ? "bg-brand-soft text-brand" : "text-ink-muted hover:bg-background hover:text-ink",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
