import { useId, type ReactNode } from "react";

/**
 * Šestougaoni bedž sa glow-om, kao cjenovni bedž u referenci. Za jedan-dva
 * ključna broja na ekranu (rezultat ispita, „80 bodova"), ne za sve.
 *
 * Šestougao je SVG iza sadržaja, pa se tekst ne sječe i ostaje pravi tekst
 * za čitače ekrana. `tone` mijenja boju ivice za prolaz/pad.
 */
type Ton = "accent" | "ok" | "err";

const BOJE: Record<Ton, { ivica: string; sjaj: string }> = {
  accent: { ivica: "var(--color-accent-2)", sjaj: "var(--color-accent)" },
  ok: { ivica: "var(--color-ok)", sjaj: "var(--color-ok)" },
  err: { ivica: "var(--color-err)", sjaj: "var(--color-err)" },
};

export default function HexBadge({
  children,
  caption,
  tone = "accent",
  size = "md",
  className = "",
}: {
  children: ReactNode;
  /** Mala oznaka ispod broja. */
  caption?: ReactNode;
  tone?: Ton;
  size?: "md" | "lg";
  className?: string;
}) {
  const id = `hex${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const boja = BOJE[tone];
  const dimenzije = size === "lg" ? "h-40 w-48 sm:h-44 sm:w-52" : "h-28 w-36";

  return (
    <div className={`relative inline-flex flex-none items-center justify-center ${dimenzije} ${className}`}>
      <svg
        aria-hidden="true"
        viewBox="0 0 120 100"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full overflow-visible"
      >
        <defs>
          <linearGradient id={`${id}-p`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={boja.sjaj} stopOpacity="0.22" />
            <stop offset="1" stopColor={boja.sjaj} stopOpacity="0.04" />
          </linearGradient>
          <filter id={`${id}-s`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>
        <polygon
          points="28,2 92,2 118,50 92,98 28,98 2,50"
          fill="none"
          stroke={boja.sjaj}
          strokeOpacity="0.55"
          strokeWidth="3"
          filter={`url(#${id}-s)`}
        />
        <polygon
          points="28,2 92,2 118,50 92,98 28,98 2,50"
          fill={`url(#${id}-p)`}
          stroke={boja.ivica}
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="relative flex flex-col items-center px-6 text-center">
        <span className={`tabular font-display leading-none font-extrabold tracking-tight text-text ${size === "lg" ? "text-5xl" : "text-4xl"}`}>
          {children}
        </span>
        {caption && (
          <span className="mt-2 font-display text-[0.625rem] font-semibold tracking-[var(--tracking-caps)] text-text-muted uppercase">
            {caption}
          </span>
        )}
      </div>
    </div>
  );
}
