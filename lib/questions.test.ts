import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  EXAM_PAGE_COUNT,
  EXAM_PASS_POINTS,
  EXAM_QUESTION_COUNT,
  EXAM_TOTAL_POINTS,
} from "./config";
import {
  bilingualOption,
  bilingualText,
  buildExam,
  examCards,
  examPoints,
  groupId,
  isHelperLang,
  situationPairPoints,
} from "./questions";
import { isChoice, type Question } from "./types";

/** Prava baza — sastav ispita zavisi od nje, pa se testira nad njom. */
const QUESTIONS: Question[] = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "public", "questions.json"), "utf8"),
);

/** Koliko pitanja i kartica ima svaka stranica (indeks 0 = str. 1). */
const PITANJA_PO_STRANI = [9, 4, 4, 4, 4, 9, 2, 2, 2];
const KARTICA_PO_STRANI = [9, 2, 2, 2, 2, 9, 1, 2, 2];

describe("buildExam — sastav po uzoru na pravi test", () => {
  // Izvlačenje je nasumično, pa se provjerava na mnogo testova.
  const ispiti = Array.from({ length: 300 }, () => buildExam(QUESTIONS));

  it("40 pitanja, numerisanih 1–40 bez ponavljanja", () => {
    for (const slots of ispiti) {
      expect(slots).toHaveLength(EXAM_QUESTION_COUNT);
      expect(slots.map((s) => s.number)).toEqual(
        Array.from({ length: EXAM_QUESTION_COUNT }, (_, i) => i + 1),
      );
      expect(new Set(slots.map((s) => s.question.id)).size).toBe(EXAM_QUESTION_COUNT);
    }
  });

  it("stranice i kartice kao na pravom testu", () => {
    for (const slots of ispiti) {
      for (let page = 1; page <= EXAM_PAGE_COUNT; page++) {
        expect(slots.filter((s) => s.page === page)).toHaveLength(PITANJA_PO_STRANI[page - 1]!);
        expect(examCards(slots, page)).toHaveLength(KARTICA_PO_STRANI[page - 1]!);
      }
    }
  });

  it("segmenti redom: teorija, situacije, znakovi, kosnik, policajac, semafori, opšta", () => {
    const ocekivano = [
      ...Array(9).fill("teorija"),
      ...Array(16).fill("situacija"),
      ...Array(8).fill("znak"),
      "kosnik",
      "policajac",
      "policajac",
      "semafor",
      "semafor",
      "opste",
      "opste",
    ];
    for (const slots of ispiti) expect(slots.map((s) => s.kind)).toEqual(ocekivano);
  });

  it("par stoji na istoj kartici: glavno pitanje pa njegovo podpitanje", () => {
    for (const slots of ispiti) {
      for (const card of [...new Set(slots.map((s) => s.card))]) {
        const uKartici = slots.filter((s) => s.card === card);
        if (uKartici.length === 1) continue;
        expect(uKartici).toHaveLength(2);
        const [glavno, pod] = uKartici;
        expect(glavno!.isSub).toBe(false);
        expect(pod!.isSub).toBe(true);
        expect(pod!.question.subOf).toBe(glavno!.question.id);
        expect(pod!.number).toBe(glavno!.number + 1);
        expect(pod!.page).toBe(glavno!.page);
      }
    }
  });

  it("situacije i policajac su uvijek parovi; ostalo su pojedinačna pitanja", () => {
    for (const slots of ispiti) {
      for (const s of slots) {
        const uParu = s.kind === "situacija" || s.kind === "policajac";
        expect(slots.filter((x) => x.card === s.card)).toHaveLength(uParu ? 2 : 1);
      }
    }
  });

  it("dva semafora nikad nemaju istu sliku (nijesu iz istog para)", () => {
    for (const slots of ispiti) {
      const semafori = slots.filter((s) => s.kind === "semafor");
      expect(new Set(semafori.map((s) => groupId(s.question))).size).toBe(2);
    }
  });

  it("parovi sa redoslijedom prolaska ostaju u izvlačenju", () => {
    const sRedoslijedom = ispiti.some((slots) =>
      slots.some((s) => s.question.type === "ordering"),
    );
    expect(sRedoslijedom).toBe(true);
  });
});

describe("bodovi ispita — kao na pravom testu: 80 bodova, prolaz od 68", () => {
  const ispiti = Array.from({ length: 300 }, () => buildExam(QUESTIONS));
  const byId = new Map(QUESTIONS.map((q) => [q.id, q]));

  it("prag je 68 od 80", () => {
    expect(EXAM_TOTAL_POINTS).toBe(80);
    expect(EXAM_PASS_POINTS).toBe(68);
  });

  it("svaki test nosi tačno 80 bodova, svako pitanje 1–4", () => {
    for (const slots of ispiti) {
      expect(examPoints(slots)).toBe(EXAM_TOTAL_POINTS);
      for (const s of slots) expect([1, 2, 3, 4]).toContain(s.points);
    }
  });

  it("po dijelovima: teorija 15, situacije 40, znakovi i kosnik 15, policajac 4, semafori 4, opšta 2", () => {
    const zbir = (slots: ReturnType<typeof buildExam>, kinds: string[]) =>
      slots.filter((s) => kinds.includes(s.kind)).reduce((n, s) => n + s.points, 0);
    for (const slots of ispiti) {
      expect(zbir(slots, ["teorija"])).toBe(15);
      expect(zbir(slots, ["situacija"])).toBe(40);
      expect(zbir(slots, ["znak", "kosnik"])).toBe(15);
      expect(zbir(slots, ["policajac"])).toBe(4);
      expect(zbir(slots, ["semafor"])).toBe(4);
      expect(zbir(slots, ["opste"])).toBe(2);
    }
  });

  it("par situacija nosi 5 bodova: 4+1 ili 3+2, redoslijed prolaska uvijek 4", () => {
    for (const slots of ispiti) {
      for (const s of slots.filter((x) => x.kind === "situacija" && !x.isSub)) {
        const par = slots.filter((x) => x.card === s.card).map((x) => x.points);
        expect(par[0]! + par[1]!).toBe(5);
        expect([[4, 1], [1, 4], [3, 2], [2, 3]]).toContainEqual(par);
      }
      for (const s of slots.filter((x) => x.kind === "situacija" && x.question.type === "ordering")) {
        expect(s.points).toBe(4);
      }
    }
  });

  it("podjela važi za svaki par situacija u bazi", () => {
    for (const sub of QUESTIONS.filter((q) => q.kind === "situacija" && q.subOf !== undefined)) {
      const [a, b] = situationPairPoints(byId.get(sub.subOf!)!, sub);
      expect(a + b).toBe(5);
    }
  });

  it("„vozilo je propisno zaustavljeno ili parkirano\" nosi 4, pitanje uz njega 1 (test 1.1, str. 3)", () => {
    // Par 198/199: vozilo 1 parkirano/zaustavljeno + ulaz-izlaz iz dvorišta.
    const glavno = byId.get(198)!;
    const pod = QUESTIONS.find((q) => q.subOf === 198)!;
    expect(situationPairPoints(glavno, pod)).toEqual([4, 1]);
  });
});

describe("dvojezični prikaz — ispit se polaže samo na ME ili AL", () => {
  const q = QUESTIONS.find((x) => x.id === 1)!;

  it("ME: samo crnogorski", () => {
    expect(bilingualText(q, "me")).toMatchObject({ primary: q.text, secondary: null });
  });

  it("AL: samo albanski", () => {
    expect(bilingualText(q, "sq")).toMatchObject({ primary: q.text_sq, primaryLang: "sq", secondary: null });
  });

  it("EN/RU: crnogorski gore, prevod ispod — i za pitanje i za odgovore", () => {
    for (const lang of ["en", "ru"] as const) {
      expect(bilingualText(q, lang)).toMatchObject({
        primary: q.text,
        primaryLang: "me",
        secondary: q[`text_${lang}`],
        secondaryLang: lang,
      });
      if (!isChoice(q)) continue;
      expect(bilingualOption(q, "b", lang)).toMatchObject({
        primary: q.options.b,
        secondary: q[`options_${lang}`]!.b,
      });
    }
  });

  it("TR: pomoćni jezik kao EN/RU — crnogorski gore, turski ispod", () => {
    expect(isHelperLang("tr")).toBe(true);
    const saTurskim = { ...q, text_tr: "Türkçe çeviri" };
    expect(bilingualText(saTurskim, "tr")).toMatchObject({
      primary: q.text,
      primaryLang: "me",
      secondary: "Türkçe çeviri",
      secondaryLang: "tr",
      fallback: false,
    });
  });

  it("bez prevoda: samo crnogorski, bez praznog reda", () => {
    const bezPrevoda = { ...q, text_en: undefined };
    const out = bilingualText(bezPrevoda, "en");
    expect(out).toMatchObject({ primary: q.text, secondary: null, fallback: false });
  });

  it("nijednom pitanju ne fali EN/RU prevod (lista po jeziku ako fali)", () => {
    const fali: Record<string, number[]> = { en: [], ru: [] };
    for (const x of QUESTIONS) {
      for (const lang of ["en", "ru"] as const) {
        const nemaOdgovor =
          isChoice(x) && (["a", "b", "c"] as const).some((k) => !x[`options_${lang}`]?.[k]);
        if (!x[`text_${lang}`] || nemaOdgovor) fali[lang]!.push(x.id);
      }
    }
    expect(fali).toEqual({ en: [], ru: [] });
  });
});
