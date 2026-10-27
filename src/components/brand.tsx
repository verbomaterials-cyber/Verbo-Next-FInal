import Image from "next/image";
import Link from "next/link";

export function Brand({ href = "/", inverse = false }: { href?: string; inverse?: boolean }) {
  return <Link href={href} className={`verbo-brand ${inverse ? "verbo-brand-inverse" : ""}`} aria-label="Verbo NEXT · Inicio">
    <Image src="/brand/verbo-symbol.png" alt="" width={31} height={33} />
    <span>Verbo <strong>NEXT<span className="brand-period">.</span></strong></span>
  </Link>;
}

export function ExamMark({ slug, name, large = false }: { slug: string; name: string; large?: boolean }) {
  return <span className={`exam-mark ${large ? "exam-mark-large" : ""}`} data-exam={slug}>
    {slug === "det" ? <Image src="/brand/det.png" alt="" width={large ? 64 : 40} height={large ? 64 : 40} />
      : slug === "toefl-ibt" ? <Image src="/brand/toefl.svg" alt="" width={large ? 110 : 68} height={large ? 45 : 29} unoptimized />
      : <span aria-hidden="true">{name.slice(0, 2).toUpperCase()}</span>}
  </span>;
}
