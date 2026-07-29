"use client";

import { useApp } from "./AppProvider";

/** Footer pune stranice — klijentska komponenta da bi pratio izbor jezika. */
export default function SiteFooter() {
  const { t } = useApp();

  return (
    <footer className="mt-8 border-t border-line bg-panel">
      <div className="mx-auto w-full max-w-3xl px-4 py-5 text-sm text-muted sm:px-6">
        <p>{t.footerNote}</p>
        <p className="mt-1">© {new Date().getFullYear()} Auto škola MIRAV</p>
      </div>
    </footer>
  );
}
