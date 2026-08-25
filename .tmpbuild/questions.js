import { DEFAULT_ORDERING_POINTS, EXAM_QUESTION_COUNT, EXAM_STRUCTURE } from "./config.js";
/**
 * Učitava bazu pitanja sa /questions.json (statički fajl iz public/).
 *
 * NAMJERNO bez `cache: "force-cache"`: ime fajla nema heš sadržaja, pa bi
 * force-cache koristio staru kopiju bez provjere kod servera — poslije izmjene
 * pitanja ili slika korisnik bi zadržao zastarjelu bazu (i dobijao 404 na slike
 * kojih više nema). Podrazumijevano ponašanje šalje uslovni zahtjev i server
 * vraća 304 ako se ništa nije promijenilo, pa je cijena zanemarljiva.
 */
export async function loadQuestions(signal) {
    const res = await fetch("/questions.json", { signal });
    if (!res.ok)
        throw new Error(`Neuspješno učitavanje pitanja (HTTP ${res.status})`);
    const data = await res.json();
    if (!Array.isArray(data))
        throw new Error("Neispravan format baze pitanja.");
    return data;
}
/** Bodovi pitanja; `ordering` u katalogu nema bod pa se koristi DEFAULT_ORDERING_POINTS. */
export function questionPoints(q) {
    return q.points ?? DEFAULT_ORDERING_POINTS;
}
/**
 * Tekst pitanja na traženom jeziku. Prevodi žive u questions.json kao
 * `text_en` / `text_ru` / `text_sq`; ako ih nema, pada se nazad na crnogorski —
 * vidi `hasTranslation`.
 */
export function localizedText(q, lang) {
    if (lang === "me")
        return q.text;
    return q[`text_${lang}`] ?? q.text;
}
/** Ponuđeni odgovor na traženom jeziku, uz isti fallback kao `localizedText`. */
export function localizedOption(q, key, lang) {
    if (lang === "me")
        return q.options[key];
    return q[`options_${lang}`]?.[key] ?? q.options[key];
}
/** Da li pitanje uopšte ima prevod na dati jezik (koristi se za napomenu u UI-u). */
export function hasTranslation(q, lang) {
    if (lang === "me")
        return true;
    return Boolean(q[`text_${lang}`]);
}
/** Fisher–Yates — vraća novi niz, ne mijenja ulazni. */
export function shuffle(items) {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const a = out[i];
        const b = out[j];
        out[i] = b;
        out[j] = a;
    }
    return out;
}
/** Nasumičan uzorak bez ponavljanja; `count` 0 ili veći od dužine vraća sve izmiješano. */
export function sample(items, count) {
    const shuffled = shuffle(items);
    if (count <= 0 || count >= shuffled.length)
        return shuffled;
    return shuffled.slice(0, count);
}
/**
 * Greška u sastavu ispita. Baca se umjesto tihe dopune iz druge kategorije:
 * ispit koji nema traženi sastav nije simulacija ispita.
 */
export class ExamBuildError extends Error {
    constructor(message) {
        super(message);
        this.name = "ExamBuildError";
    }
}
/**
 * Sastavlja simulaciju ispita po `EXAM_STRUCTURE`.
 *
 * Za svaki segment redom:
 *  - izvlači `count` nasumičnih pitanja tog `kind`-a, bez ponavljanja,
 *  - ako je `withSub`, bira samo pitanja koja **imaju** podpitanje i odmah iza
 *    svakog ubacuje to podpitanje,
 *  - ako nema dovoljno pitanja, **baca `ExamBuildError`** — ne dopunjava iz
 *    druge kategorije, jer bi tako ispit tiho izgubio traženi sastav.
 *
 * Redoslijed segmenata u testu je redoslijed unosa u `EXAM_STRUCTURE`; unutar
 * segmenta je nasumičan. Bodovi se ne podešavaju — dolaze iz baze kakvi jesu,
 * pa ukupan broj bodova nije isti na svakom testu (prag je procenat, vidi
 * `examPassPoints`).
 */
export function buildExam(questions) {
    // Podpitanja nikad ne ulaze u izvlačenje sama za sebe.
    const subsByMain = new Map();
    for (const q of questions) {
        if (q.subOf !== undefined)
            subsByMain.set(q.subOf, q);
    }
    const slots = [];
    EXAM_STRUCTURE.forEach((segment, index) => {
        const pool = questions.filter((q) => q.kind === segment.kind &&
            q.subOf === undefined &&
            (!segment.withSub || subsByMain.has(q.id)));
        if (pool.length < segment.count) {
            throw new ExamBuildError(`Segment „${segment.kind}"${segment.withSub ? " (sa podpitanjem)" : ""}: ` +
                `traži ${segment.count} pitanja, a u bazi ih ima ${pool.length}. ` +
                `Pokreni \`node scripts/gen-exam-meta.mjs --report\`.`);
        }
        for (const q of sample(pool, segment.count)) {
            slots.push({ question: q, kind: segment.kind, segment: index, isSub: false });
            if (!segment.withSub)
                continue;
            const sub = subsByMain.get(q.id);
            if (!sub) {
                // Ne bi smjelo — bazen je već filtriran na pitanja sa podpitanjem.
                throw new ExamBuildError(`Pitanje ${q.id} nema podpitanje iako je izvučeno kao par.`);
            }
            slots.push({ question: sub, kind: segment.kind, segment: index, isSub: true });
        }
    });
    if (slots.length !== EXAM_QUESTION_COUNT) {
        throw new ExamBuildError(`Sastavljen ispit ima ${slots.length} pitanja, a treba ${EXAM_QUESTION_COUNT}.`);
    }
    return slots;
}
/** Broj izvučenih pitanja po segmentu — koristi se u provjerama. */
export function kindBreakdown(questions) {
    const out = {};
    for (const q of questions)
        out[q.kind] = (out[q.kind] ?? 0) + 1;
    return out;
}
/**
 * Oznaka pitanja u navigaciji: podpitanje nosi slovo uz broj glavnog pitanja
 * („15" i „15a"), da kandidat vidi da idu u paru.
 */
export function slotLabel(slots, index) {
    let main = 0;
    for (let i = 0; i <= index; i++) {
        if (!slots[i]?.isSub)
            main += 1;
    }
    return slots[index]?.isSub ? `${main}a` : String(main);
}
/**
 * Vraća pitanja tačno onim redom kojim su ID-evi navedeni.
 * Koristi se za „nastavi vježbu" — bez sačuvanog redoslijeda korisnik bi se
 * vratio na isti *indeks*, ali na sasvim drugo pitanje.
 */
export function byIds(questions, ids) {
    const map = new Map(questions.map((q) => [q.id, q]));
    const out = [];
    for (const id of ids) {
        const q = map.get(id);
        if (q)
            out.push(q);
    }
    return out;
}
/** Ostavlja samo cifre: "3-4-2-1", "3 4 2 1", "3421" → "3421". */
export function normalizeSequence(value) {
    return value.replace(/\D/g, "");
}
/** Tačan redoslijed u kanonskom obliku za prikaz: "3-4-2-1". */
export function formatSequence(sequence) {
    return sequence.join("-");
}
export function isOrderingCorrect(q, value) {
    const given = normalizeSequence(value);
    return given.length > 0 && given === normalizeSequence(q.answer_sequence.join(""));
}
export function isChoiceCorrect(q, value) {
    return value === q.correct;
}
/** Da li je odgovor tačan — jedinstvena tačka istine za oba tipa pitanja. */
export function isAnswerCorrect(q, answer) {
    if (q.type === "ordering") {
        return answer.kind === "ordering" && isOrderingCorrect(q, answer.value);
    }
    return answer.kind === "choice" && isChoiceCorrect(q, answer.value);
}
/** Ukupan broj bodova skupa pitanja (maksimum na ispitu). */
export function totalPoints(questions) {
    return questions.reduce((sum, q) => sum + questionPoints(q), 0);
}
/** Formatira sekunde u mm:ss. */
export function formatClock(seconds) {
    const safe = Math.max(seconds, 0);
    const m = Math.floor(safe / 60);
    const s = safe % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
