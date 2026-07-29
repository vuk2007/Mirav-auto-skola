import AppProvider from "@/components/AppProvider";
import BrandHeader from "@/components/BrandHeader";
import Quiz from "@/components/Quiz";
import SiteFooter from "@/components/SiteFooter";

export default function HomePage() {
  return (
    // Jezik i „nazad na početak" obuhvataju zaglavlje, kviz i footer.
    <AppProvider>
      <BrandHeader />

      {/* Potpisni element: isprekidana traka kao oznaka na kolovozu. */}
      <div className="road-line" aria-hidden="true" />

      {/* Naslov, opis režima i prebacivač jezika žive u Quiz-u. */}
      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <Quiz />
      </main>

      <SiteFooter />
    </AppProvider>
  );
}
