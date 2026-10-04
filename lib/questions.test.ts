import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EXAM_PAGE_COUNT, EXAM_QUESTION_COUNT } from "./config";
import { buildExam, examCards, groupId } from "./questions";
import type { Question } from "./types";

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
