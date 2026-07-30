/**
 * Domeni sa kojih je dozvoljeno ugraditi /embed u <iframe>.
 * Drži usklađeno sa FRAME_ANCESTORS u lib/config.ts.
 */
const FRAME_ANCESTORS = ["'self'", "https://mirav.me", "https://*.mirav.me"];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

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
