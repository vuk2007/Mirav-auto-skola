import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin", "latin-ext"],
  weight: ["600", "700"],
  variable: "--font-barlow-condensed",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Teorijski test — Auto škola MIRAV",
  description:
    "Besplatna priprema za teorijski ispit: vježba po kategorijama i simulacija ispita, B kategorija.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sr-ME" className={`${inter.variable} ${barlowCondensed.variable}`}>
      <body>
        {children}
        {/*
          Vercel Web Analytics. Šalje podatke samo kad je deploy na Vercelu —
          lokalno i u buildu van Vercela je bez efekta, pa ne treba uslovljavanje.
          Stoji u korijenskom layoutu, pa pokriva i `/embed`, koji se na mirav.me
          učitava u iframe-u; posjete kroz iframe se broje kao i ostale.
        */}
        <Analytics />
      </body>
    </html>
  );
}
