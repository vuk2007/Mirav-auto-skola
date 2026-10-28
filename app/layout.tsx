import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { Inter, Montserrat } from "next/font/google";
import "./globals.css";

/*
  Oba fonta nose latin-ext (š č ć ž đ, albanski ë ç, turski ğ ş ı İ) i
  ćirilicu za ruski. next/font ih preuzme pri buildu i servira sa našeg domena.
*/
const inter = Inter({
  subsets: ["latin", "latin-ext", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
});

const montserrat = Montserrat({
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["600", "700", "800"],
  variable: "--font-montserrat",
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
  themeColor: "#070b14",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sr-ME" className={`${inter.variable} ${montserrat.variable}`}>
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
