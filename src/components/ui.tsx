"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/* ───────────── Botones ───────────── */

const buttonVariants = {
  primary:
    "bg-brand text-white shadow-sm hover:bg-brand-strong hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed",
  ghost: "text-ink-muted hover:bg-brand-soft hover:text-ink",
  outline:
    "border border-line-strong text-ink shadow-sm hover:border-brand hover:text-brand hover:shadow-md",
  danger: "text-danger hover:bg-danger-soft",
} as const;

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof buttonVariants;
  size?: "sm" | "md";
}) {
  return (
    <button
      {...props}
      className={cn(
        "rounded-lg font-medium transition-[background-color,border-color,color,transform,box-shadow] duration-150 ease-(--ease-out) active:scale-[0.97] disabled:active:scale-100",
        size === "sm" ? "px-3 py-1.5 text-sm" : "px-5 py-2 text-sm",
        buttonVariants[variant],
        className,
      )}
    />
  );
}

/* ───────────── Campos de formulario ───────────── */

const inputClass =
  "w-full rounded-xl border border-line-strong bg-surface px-3 py-2 text-sm shadow-sm transition-[border-color,box-shadow] duration-150 ease-(--ease-out) focus:border-brand focus:shadow-[0_0_0_3px_var(--brand-soft)] focus:outline-none disabled:opacity-50";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputClass, props.className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(inputClass, "leading-relaxed", props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(inputClass, "bg-surface", props.className)} />;
}

export function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {help && <span className="mt-1 block text-xs text-ink-muted">{help}</span>}
    </label>
  );
}

export function Checkbox({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input type="checkbox" {...props} className="size-4 accent-(--brand)" />
      {label}
    </label>
  );
}

/* ───────────── Feedback ───────────── */

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="whitespace-pre-wrap rounded-lg bg-danger-soft px-3.5 py-2.5 text-sm text-danger">
      {children}
    </p>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "brand" | "success" | "warning";
}) {
  const tones = {
    neutral: "bg-background text-ink-muted border border-line",
    brand: "bg-brand-soft text-brand",
    success: "bg-brand-soft text-success",
    warning: "bg-danger-soft text-danger",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium transition-colors duration-150", tones[tone])}>
      {children}
    </span>
  );
}

/* ───────────── Modal (native <dialog>) ───────────── */

const MODAL_CLOSE_MS = 160;

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [renderState, setRenderState] = useState({ open, mounted: open });
  if (renderState.open !== open) {
    setRenderState({ open, mounted: open || renderState.mounted });
  }

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) dialog.showModal();
      // rAF para que el navegador registre el estado inicial antes de animar a "open"
      const frame = requestAnimationFrame(() => dialog.setAttribute("data-state", "open"));
      return () => cancelAnimationFrame(frame);
    }
    if (!open) {
      dialog.removeAttribute("data-state");
      const timer = setTimeout(() => {
        dialog.close();
        setRenderState({ open: false, mounted: false });
      }, MODAL_CLOSE_MS);
      return () => clearTimeout(timer);
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onMouseDown={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "modal-surface m-auto w-[calc(100vw-2rem)] rounded-2xl border border-line bg-surface p-0 shadow-2xl",
        wide ? "max-w-3xl" : "max-w-lg",
      )}
    >
      {renderState.mounted && (
        <div className="max-h-[85dvh] overflow-y-auto p-5 sm:p-6">
          <h2 className="text-lg font-semibold tracking-tight text-balance">{title}</h2>
          <div className="mt-5">{children}</div>
        </div>
      )}
    </dialog>
  );
}
