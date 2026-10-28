"use client";

import { ArrowRight } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";

/**
 * Dugme u tri varijante.
 *
 * - `primary`: puna plava sa blagim gradijentom i mekim glow-om. Jedno po ekranu,
 *   za glavnu radnju. Strelica desno se pomjeri na hover.
 * - `secondary`: stakleni obris, za drugu radnju pored primarne.
 * - `ghost`: samo tekst, za tihe radnje (Nazad, Zatvori).
 *
 * Tekst je uppercase sa razmakom slova, kao u referenci; za duge prevode (RU, AL)
 * dugme se prelama u dva reda umjesto da izlazi iz okvira.
 */
type Varijanta = "primary" | "secondary" | "ghost";
type Velicina = "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  ref?: Ref<HTMLButtonElement>;
  variant?: Varijanta;
  size?: Velicina;
  /** Strelica desno; podrazumijevano samo za primarno dugme. */
  arrow?: boolean;
  /** Ikonica lijevo (lucide). */
  icon?: ReactNode;
  fullWidth?: boolean;
}

const OSNOVA =
  "group relative inline-flex items-center justify-center gap-3 text-center font-display font-bold uppercase " +
  "tracking-[var(--tracking-caps)] transition-[background,box-shadow,border-color,color,transform] duration-200 ease-[var(--ease-izlaz)] " +
  "disabled:pointer-events-none disabled:opacity-45";

const VARIJANTE: Record<Varijanta, string> = {
  primary:
    "rounded-md bg-gradient-to-b from-accent to-accent-deep text-white shadow-glow " +
    "hover:to-accent active:translate-y-px",
  secondary:
    "rounded-md border border-glass-line-strong bg-glass text-text " +
    "hover:border-accent-line hover:bg-glass-strong",
  ghost: "rounded-sm text-text-muted hover:text-text",
};

const VELICINE: Record<Velicina, string> = {
  md: "min-h-11 px-5 py-2.5 text-[0.8125rem]",
  lg: "min-h-14 px-7 py-3.5 text-sm",
};

export default function Button({
  variant = "primary",
  size = "lg",
  arrow,
  icon,
  fullWidth,
  className = "",
  children,
  type = "button",
  ...ostalo
}: ButtonProps) {
  const saStrelicom = arrow ?? variant === "primary";
  return (
    <button
      type={type}
      className={`${OSNOVA} ${VARIJANTE[variant]} ${variant === "ghost" ? "min-h-11 px-2 text-[0.8125rem]" : VELICINE[size]} ${
        fullWidth ? "w-full" : ""
      } ${saStrelicom ? "justify-between text-left" : ""} ${className}`}
      {...ostalo}
    >
      {icon && <span className="flex-none [&>svg]:h-[1.1em] [&>svg]:w-[1.1em]">{icon}</span>}
      <span className="min-w-0">{children}</span>
      {saStrelicom && (
        <ArrowRight
          aria-hidden="true"
          strokeWidth={1.75}
          className="h-5 w-5 flex-none transition-transform duration-200 ease-[var(--ease-izlaz)] group-hover:translate-x-1"
        />
      )}
    </button>
  );
}
