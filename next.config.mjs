/**
 * Domeni sa kojih je dozvoljeno ugraditi /embed u <iframe>.
 * Drži usklađeno sa FRAME_ANCESTORS u lib/config.ts.
 */
const FRAME_ANCESTORS = ["'self'", "https://mirav.me", "https://*.mirav.me"];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Fajlovi `*.dev.ts(x)` su rute samo uz `npm run dev` (editor grada piše
  // overlay u repozitorijum). Produkcijski build ih ne vidi: na Vercel-u nema
  // ni rute ni serverske funkcije. `dev.*` mora biti ispred `ts`/`tsx`, da se
  // `route.dev.ts` čita kao `route`, a ne kao `route.dev`.
  pageExtensions:
    process.env.NODE_ENV === "development" ? ["dev.ts", "dev.tsx", "tsx", "ts", "jsx", "js"] : ["tsx", "ts", "jsx", "js"],

  images: {
    // Slike se serviraju kakve jesu, bez Vercel optimizacije (WebP/resize).
    // Razlog: Hobby plan ima mjesečnu kvotu transformacija, a baza ima 281
    // sliku; sve su ionako male (~60 kB) i dimenzionisane za prikaz.
    // Ako se pređe na plaćeni plan, dovoljno je obrisati ovu opciju.
    unoptimized: true,
  },

  async headers() {
    return [
      {
        // Ugradiva ruta: umjesto X-Frame-Options koristi se frame-ancestors,
        // koji jedini podržava listu dozvoljenih domena.
        source: "/embed",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `frame-ancestors ${FRAME_ANCESTORS.join(" ")};`,
          },
        ],
      },
      {
        // Podrute /embed (npr. /embed/simulator) moraju dobiti isto zaglavlje.
        source: "/embed/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `frame-ancestors ${FRAME_ANCESTORS.join(" ")};`,
          },
        ],
      },
      {
        // Interni alat za reviziju — van pretrage i kad je deploy javan.
        // Isto stoji i u `metadata.robots` stranice; zaglavlje hvata i slučaj
        // kad robot ne izvrši JS.
        source: "/audit",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }],
      },
      {
        // Paket grada nosi otisak sadržaja u imenu (`podgorica-<otisak>.bin`):
        // novi podaci su nova adresa, pa se ovaj smije keširati zauvijek — jedan
        // zahtjev po gradu, jednom. Spisak `gradovi.json` nema ovo zaglavlje,
        // da bi nova verzija bila vidljiva odmah.
        source: "/data/grad/:fajl([a-z-]+-[0-9a-f]{10}\\.bin)",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        // Mjerilo crtanja igre — razvojni alat, isto van pretrage.
        source: "/igra/bench",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }],
      },
      {
        // Editor kazni — isto van pretrage. Ruta je 404 kad je flag isključen,
        // ali zaglavlje mora stajati i kad je uključen, dok traje unos.
        source: "/admin/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }],
      },
      {
        // Sve ostale rute se ne smiju ugrađivati.
        source: "/((?!embed).*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
