import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/prijava/route";
import { MAX_OPIS, napraviOgranicenje, naslovPrijave, procitajPrijavu, tijeloPrijave, type Prijava } from "./prijava";

const ispravna = {
  vrsta: "odgovor",
  opis: "Tačan odgovor je B, ne A.",
  jezik: "en",
  rezim: "vjezba",
  pitanjeId: 412,
  pitanjeTekst: "Ko ima prvenstvo?",
};

function prijava(izmjene: Record<string, unknown> = {}): Prijava {
  const p = procitajPrijavu({ ...ispravna, ...izmjene });
  if (!p) throw new Error("prijava je trebalo da prođe");
  return p;
}

describe("procitajPrijavu", () => {
  it("odbija neispravan zahtjev", () => {
    for (const telo of [
      null,
      5,
      "x",
      {},
      { ...ispravna, vrsta: "nepostojeca" },
      { ...ispravna, opis: "ab" },
      { ...ispravna, opis: 7 },
    ]) {
      expect(procitajPrijavu(telo)).toBeNull();
    }
  });

  it("nepoznate vrijednosti odbacuje, a dugačak tekst skraćuje", () => {
    const p = prijava({ jezik: "xx", rezim: "hak", pitanjeId: "412; drop", opis: "a".repeat(MAX_OPIS + 50) });
    expect(p.jezik).toBeNull();
    expect(p.rezim).toBeNull();
    expect(p.pitanjeId).toBeNull();
    expect(p.opis).toHaveLength(MAX_OPIS);
  });

  it("uklanja kontrolne znakove, a redove čuva", () => {
    expect(prijava({ opis: "  prvi\r\ndrugi\u0007 red  " }).opis).toBe("prvi\ndrugi red");
  });
});

describe("tekst Issue-a", () => {
  const server = { uredjaj: "Telefon", verzija: "abc1234" };

  it("naslov nosi samo provjerene vrijednosti", () => {
    expect(naslovPrijave(prijava({ opis: "@svi pogledajte ovo" }))).toBe("[Pitanje 412] Netačan odgovor");
    expect(naslovPrijave(prijava({ vrsta: "sajt", pitanjeId: undefined }))).toBe("[Sajt] Problem na sajtu");
  });

  it("korisnikov tekst ne može da izađe iz kod-bloka", () => {
    const tijelo = tijeloPrijave(prijava({ opis: "kraj ``` @vuk2007 ![x](http://zlo) ````` #1" }), server);
    const redovi = tijelo.split("\n");
    const i = redovi.findIndex((r) => r.includes("@vuk2007"));
    expect(redovi[i - 1]).toBe("``````text");
    expect(redovi[i + 1]).toBe("``````");
  });

  it("sadrži pitanje i tehničke podatke, a kontakt samo ako postoji", () => {
    const bez = tijeloPrijave(prijava(), server);
    expect(bez).toContain("Ko ima prvenstvo?");
    expect(bez).toContain("jezik: en");
    expect(bez).toContain("verzija: abc1234");
    expect(bez).not.toContain("**Kontakt**");
    expect(tijeloPrijave(prijava({ kontakt: "a@b.me" }), server)).toContain("a@b.me");
  });
});

describe("napraviOgranicenje", () => {
  it("broji po ključu i oslobađa se kad prozor prođe", () => {
    const preko = napraviOgranicenje(2, 1000);
    expect(preko("a", 0)).toBe(false);
    expect(preko("a", 10)).toBe(false);
    expect(preko("a", 20)).toBe(true);
    expect(preko("b", 20)).toBe(false);
    expect(preko("a", 1005)).toBe(false);
  });
});

describe("POST /api/prijava", () => {
  let adresa = 0;
  const posalji = (telo: unknown, ip = `10.0.0.${++adresa}`) =>
    POST(
      new Request("http://localhost/api/prijava", {
        method: "POST",
        headers: { "x-real-ip": ip, "user-agent": "test" },
        body: typeof telo === "string" ? telo : JSON.stringify(telo),
      }),
    );

  const fetchLazni = vi.fn();

  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchLazni.mockReset();
    vi.stubGlobal("fetch", fetchLazni);
    vi.stubEnv("GITHUB_PRIJAVE_TOKEN", "");
    vi.stubEnv("GITHUB_PRIJAVE_REPO", "");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("bez tokena prijava ide u log, a GitHub se ne zove", async () => {
    expect((await posalji(ispravna)).status).toBe(200);
    expect(fetchLazni).not.toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(console.log).mock.calls)).toContain("[Pitanje 412]");
  });

  it("sa tokenom pravi Issue i ne upisuje prijavu u log", async () => {
    vi.stubEnv("GITHUB_PRIJAVE_TOKEN", "tajna");
    fetchLazni.mockResolvedValue(new Response("{}", { status: 201 }));
    expect((await posalji(ispravna)).status).toBe(200);
    const [url, init] = fetchLazni.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.github.com/repos/vuk2007/Mirav-auto-skola/issues");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tajna");
    expect(JSON.parse(init.body as string).title).toBe("[Pitanje 412] Netačan odgovor");
    expect(console.log).not.toHaveBeenCalled();
  });

  it("kad GitHub odbije ili je nedostupan: greška korisniku, prijava u log, bez tokena u logu", async () => {
    vi.stubEnv("GITHUB_PRIJAVE_TOKEN", "tajna");
    fetchLazni.mockResolvedValueOnce(new Response("{}", { status: 401 }));
    expect((await posalji(ispravna)).status).toBe(502);
    fetchLazni.mockRejectedValueOnce(new Error("mreža"));
    expect((await posalji(ispravna)).status).toBe(502);
    const upisano = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(console.error).toHaveBeenCalledTimes(2);
    expect(upisano).toContain("[Pitanje 412]");
    expect(upisano).not.toContain("tajna");
  });

  it("skriveno polje: bot dobija uspjeh, a prijava nigdje ne ide", async () => {
    vi.stubEnv("GITHUB_PRIJAVE_TOKEN", "tajna");
    expect((await posalji({ ...ispravna, adresaSajta: "http://spam" })).status).toBe(200);
    expect(fetchLazni).not.toHaveBeenCalled();
    expect(console.log).not.toHaveBeenCalled();
  });

  it("odbija neispravan i prevelik zahtjev", async () => {
    expect((await posalji("nije json")).status).toBe(400);
    expect((await posalji({ vrsta: "odgovor", opis: "x" })).status).toBe(400);
    expect((await posalji({ ...ispravna, opis: "a".repeat(9000) })).status).toBe(413);
  });

  it("preko granice sa iste adrese vraća 429", async () => {
    for (let i = 0; i < 10; i++) expect((await posalji(ispravna, "10.9.9.9")).status).toBe(200);
    expect((await posalji(ispravna, "10.9.9.9")).status).toBe(429);
    expect((await posalji(ispravna, "10.9.9.10")).status).toBe(200);
  });
});
