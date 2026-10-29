"use client";

import { useApp } from "./AppProvider";

/** Footer pune stranice — klijentska komponenta da bi pratio izbor jezika. */
export default function SiteFooter() {
  const { t } = useApp();

  return (
    <footer className="mt-12 border-t border-glass-line">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-text-muted sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <p className="max-w-xl leading-relaxed">{t.footerNote}</p>
        <p className="font-display text-[0.6875rem] font-semibold tracking-[var(--tracking-caps)] uppercase">
          © {new Date().getFullYear()} Auto škola MIRAV
        </p>
      </div>
    </footer>
  );
}
