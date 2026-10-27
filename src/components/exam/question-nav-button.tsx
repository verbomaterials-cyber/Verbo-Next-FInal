"use client";

/*
 * <QuestionNavButton> — botón de navegación del motor, temable por CSS vars.
 * variant "primary": relleno de acento, radio --xcontrol (DET pill / TOEFL
 *   rect editorial), tipografía --xbtn-font (display en DET, sans en TOEFL).
 * variant "back": contorno hairline discreto.
 * Sin lógica por examen: solo lee las variables que inyecta el motor.
 */

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "back";
};

export function QuestionNavButton({ variant = "primary", children, ...props }: Props) {
  if (variant === "back") {
    return (
      <button
        {...props}
        className="transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40"
        style={{
          borderRadius: "var(--xcontrol)",
          border: "1px solid var(--xline)",
          color: "var(--xmuted)",
          padding: "0.7rem 1.4rem",
          fontFamily: "var(--xfont-body)",
          fontSize: "0.9rem",
          fontWeight: 500,
          letterSpacing: "0.01em",
        }}
      >
        {children}
      </button>
    );
  }

  return (
    <button
      {...props}
      className="transition-[filter,opacity] duration-150 not-disabled:hover:brightness-[0.96] disabled:cursor-not-allowed disabled:opacity-40"
      style={{
        borderRadius: "var(--xcontrol)",
        backgroundColor: "var(--xaccent)",
        color: "var(--xon-accent)",
        padding: "0.9rem 2.75rem",
        fontFamily: "var(--xbtn-font)",
        fontSize: "1.02rem",
        fontWeight: 600,
        letterSpacing: "var(--xbtn-tracking, 0)",
      }}
    >
      {children}
    </button>
  );
}
