import type { LucideIcon } from "lucide-react";

/**
 * Ikonica u kružnom obrisu, kao u listi „MODERNA VOZILA / ISKUSNI INSTRUKTORI".
 * Jedan set (lucide), tanka linija (1.5).
 */
export default function IconCircle({
  icon: Ikona,
  size = "md",
  tone = "accent",
  className = "",
}: {
  icon: LucideIcon;
  size?: "sm" | "md" | "lg";
  tone?: "accent" | "ok" | "err" | "muted";
  className?: string;
}) {
  const krug = size === "lg" ? "h-14 w-14" : size === "sm" ? "h-9 w-9" : "h-12 w-12";
  const ikona = size === "lg" ? "h-6 w-6" : size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const boja = {
    accent: "border-accent-line text-accent-2",
    ok: "border-ok-line text-ok",
    err: "border-err-line text-err",
    muted: "border-glass-line-strong text-text-muted",
  }[tone];
  return (
    <span
      aria-hidden="true"
      className={`inline-flex flex-none items-center justify-center rounded-full border ${krug} ${boja} ${className}`}
    >
      <Ikona strokeWidth={1.5} className={ikona} />
    </span>
  );
}
