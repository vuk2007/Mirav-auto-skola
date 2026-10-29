import AppProvider from "@/components/AppProvider";
import BrandHeader from "@/components/BrandHeader";
import Quiz from "@/components/Quiz";
import SiteFooter from "@/components/SiteFooter";

export default function HomePage() {
  return (
    // Jezik i „nazad na početak" obuhvataju zaglavlje, kviz i footer.
    <AppProvider>
      <BrandHeader />

      {/*
        Početna koristi punu širinu (podijeljen hero na desktopu); ostali
        ekrani se u Quiz-u sami suze na kolonu za čitanje (max-w-3xl).
      */}
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <Quiz />
      </main>

      <SiteFooter />
    </AppProvider>
  );
}
