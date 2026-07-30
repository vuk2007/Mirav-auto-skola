#!/usr/bin/env node
/**
 * Mašinski prevod baze pitanja na engleski i ruski.
 *
 * VAŽNO: ovo je pomoć u učenju, a ne zvanični prevod. Zvanični ispit je na
 * crnogorskom. Prije objave prevoda izvorni govornik EN/RU mora da provjeri
 * ključne saobraćajne termine (npr. „ustupi prvenstvo prolaza", „raskrsnica",
 * „prvenstvo prolaza", „nepregledna krivina").
 *
 * Skripta NIKAD ne dira `correct`, `answer_sequence`, `id`, `points`, `area`
 * ni bilo koje drugo postojeće polje — upisuje samo `text_en` / `options_en` i
 * `text_ru` / `options_ru`. Na kraju svakog paketa provjerava da su tačni
 * odgovori bit-identični ulazu i prekida rad ako nisu.
 *
 * Upotreba:
 *   ANTHROPIC_API_KEY=... node scripts/translate.mjs                 # en + ru, sve neprevedeno
 *   ANTHROPIC_API_KEY=... node scripts/translate.mjs --lang=ru
 *   ANTHROPIC_API_KEY=... node scripts/translate.mjs --lang=en --limit=20
 *   node scripts/translate.mjs --stats                               # samo izvještaj, bez API-ja
 *
 * Opcije:
 *   --lang=en,ru   koje jezike prevoditi (podrazumijevano oba)
 *   --limit=N      najviše N pitanja po jeziku (za probni krug)
 *   --batch=N      koliko pitanja ide u jedan zahtjev (podrazumijevano 8)
 *   --model=ID     model (podrazumijevano claude-opus-5)
 *   --file=PUT     druga baza pitanja (podrazumijevano public/questions.json)
 *   --stats        prikaži pokrivenost prevodima i izađi
 *   --dry-run      ispiši šta bi se prevelo, bez poziva API-ja i bez upisa
 *
 * Skripta je otporna na prekid: posao se upisuje na disk nakon svakog paketa,
 * a pitanja koja već imaju prevod se preskaču — pa se ponovnim pokretanjem
 * nastavlja tamo gdje se stalo.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import Anthropic from "@anthropic-ai/sdk";

const DEFAULT_MODEL = "claude-opus-5";
const DEFAULT_BATCH = 8;
const OPTION_KEYS = ["a", "b", "c"];

const LANGS = {
  en: { name: "English", textField: "text_en", optionsField: "options_en" },
  ru: { name: "Russian", textField: "text_ru", optionsField: "options_ru" },
};

// ── argumenti ──────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = {
    langs: ["en", "ru"],
    limit: Infinity,
    batch: DEFAULT_BATCH,
    model: DEFAULT_MODEL,
    file: path.join("public", "questions.json"),
    stats: false,
    dryRun: false,
  };
  for (const arg of argv) {
    if (arg === "--stats") out.stats = true;
    else if (arg === "--dry-run") out.dryRun = true;
    else if (arg.startsWith("--lang=")) {
      const langs = arg
        .slice("--lang=".length)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      for (const l of langs) {
        if (!LANGS[l]) fail(`Nepoznat jezik „${l}". Podržani: ${Object.keys(LANGS).join(", ")}.`);
      }
      if (langs.length === 0) fail("--lang je prazan.");
      out.langs = langs;
    } else if (arg.startsWith("--limit=")) {
      out.limit = positiveInt(arg, "--limit");
    } else if (arg.startsWith("--batch=")) {
      out.batch = positiveInt(arg, "--batch");
    } else if (arg.startsWith("--model=")) {
      out.model = arg.slice("--model=".length);
    } else if (arg.startsWith("--file=")) {
      out.file = arg.slice("--file=".length);
    } else {
      fail(`Nepoznat argument „${arg}". Vidi komentar na vrhu skripte.`);
    }
  }
  return out;
}

function positiveInt(arg, flag) {
  const n = Number(arg.slice(flag.length + 1));
  if (!Number.isInteger(n) || n < 1) fail(`${flag} mora biti cio broj veći od nule.`);
  return n;
}

function fail(message) {
  console.error(`Greška: ${message}`);
  process.exit(1);
}

// ── baza ───────────────────────────────────────────────────────────────────

function loadQuestions(file) {
  if (!fs.existsSync(file)) fail(`Nema fajla ${file}.`);
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Array.isArray(data)) fail(`${file} ne sadrži niz pitanja.`);
  return data;
}

/**
 * Baza se upisuje sa dva razmaka uvlačenja i završnim novim redom — isti oblik
 * koji generatori baze već koriste, da diff ostane čitljiv.
 */
function saveQuestions(file, questions) {
  fs.writeFileSync(file, `${JSON.stringify(questions, null, 2)}\n`, "utf8");
}

function hasOptions(q) {
  return q.type === "text" || q.type === "image";
}

/** Pitanje je prevedeno kad ima tekst i (ako ih traži) sve tri opcije. */
export function isTranslated(q, lang) {
  const { textField, optionsField } = LANGS[lang];
  if (!q[textField]) return false;
  if (!hasOptions(q)) return true;
  const opts = q[optionsField];
  return Boolean(opts) && OPTION_KEYS.every((k) => typeof opts[k] === "string" && opts[k] !== "");
}

/** Otisak tačnih odgovora — poredi se prije i posle upisa. */
export function answerFingerprint(questions) {
  return JSON.stringify(
    questions.map((q) => [q.id, q.correct ?? null, q.answer_sequence ?? null]),
  );
}

function reportStats(questions, langs) {
  console.log(`Ukupno pitanja: ${questions.length}`);
  for (const lang of langs) {
    const done = questions.filter((q) => isTranslated(q, lang)).length;
    const pct = questions.length === 0 ? 0 : Math.round((done / questions.length) * 100);
    console.log(`  ${lang}: ${done}/${questions.length} prevedeno (${pct}%)`);
  }
}

// ── prompt ─────────────────────────────────────────────────────────────────

function systemPrompt(langName) {
  return [
    `You translate a Montenegrin (ijekavica) driving-theory exam question bank into ${langName}.`,
    "",
    "These are official driving-licence theory questions. Accuracy of meaning outweighs fluency:",
    "a mistranslated traffic term makes the question unanswerable or changes which answer is correct.",
    "",
    "Rules:",
    `- Use the standard ${langName} road-traffic vocabulary a driving school would use`,
    "  (right of way, priority road, give way, roundabout, pedestrian crossing, blind bend, …).",
    "- Translate meaning exactly. Never add, drop, soften, or explain anything that is not in the source.",
    "- The three options are deliberately similar and often differ by a single word or number.",
    "  Preserve those differences precisely — do not merge, reorder, or normalise them.",
    "- Keep every number, unit, distance, speed, sign name and sign code exactly as written.",
    "- Keep the source register: short, formal, impersonal. Preserve trailing colons and punctuation.",
    "- Do not translate the option keys a/b/c, and do not mark which option is correct.",
    "- Output only the translation, with no commentary.",
  ].join("\n");
}

function userPrompt(items) {
  return [
    "Translate every item below. Return one entry per item, with the same `id`.",
    "",
    JSON.stringify(items, null, 2),
  ].join("\n");
}

export function schemaFor(withOptions) {
  const item = {
    type: "object",
    properties: {
      id: { type: "integer" },
      text: { type: "string" },
    },
    required: ["id", "text"],
    additionalProperties: false,
  };
  if (withOptions) {
    item.properties.options = {
      type: "object",
      properties: {
        a: { type: "string" },
        b: { type: "string" },
        c: { type: "string" },
      },
      required: OPTION_KEYS,
      additionalProperties: false,
    };
    item.required = ["id", "text", "options"];
  }
  return {
    type: "object",
    properties: { items: { type: "array", items: item } },
    required: ["items"],
    additionalProperties: false,
  };
}

// ── prevod ─────────────────────────────────────────────────────────────────

/** Šta se šalje modelu — samo tekst i opcije, bez tačnog odgovora. */
function payloadFor(q) {
  const item = { id: q.id, text: q.text };
  if (hasOptions(q)) {
    item.options = { a: q.options.a, b: q.options.b, c: q.options.c };
  }
  return item;
}

async function translateBatch(client, { model, langName, batch, withOptions }) {
  const stream = client.messages.stream({
    model,
    // Paket od 8 pitanja sa opcijama daje najviše par hiljada tokena, ali
    // adaptivno razmišljanje se troši iz istog budžeta — otud širok max_tokens.
    max_tokens: 32000,
    thinking: { type: "adaptive" },
    system: systemPrompt(langName),
    output_config: { format: { type: "json_schema", schema: schemaFor(withOptions) } },
    messages: [{ role: "user", content: userPrompt(batch.map(payloadFor)) }],
  });

  const message = await stream.finalMessage();

  if (message.stop_reason === "refusal") {
    throw new Error("Model je odbio zahtjev (stop_reason: refusal).");
  }
  if (message.stop_reason === "max_tokens") {
    throw new Error("Odgovor je odsječen na max_tokens — smanjite --batch.");
  }

  const text = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
  if (!text) throw new Error("Prazan odgovor modela.");

  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed.items)) throw new Error("Odgovor nema polje `items`.");
  return parsed.items;
}

/**
 * Upisuje prevode u pitanja. Vraća koliko je pitanja popunjeno. Odbija paket u
 * cjelini ako se id-jevi ne poklapaju ili nešto nedostaje — bolje preskočiti
 * paket nego upisati prevod na pogrešno pitanje.
 */
export function applyBatch(items, batch, lang) {
  const { textField, optionsField } = LANGS[lang];
  const byId = new Map(batch.map((q) => [q.id, q]));

  if (items.length !== batch.length) {
    throw new Error(`Model je vratio ${items.length} stavki za ${batch.length} pitanja.`);
  }

  const staged = [];
  for (const item of items) {
    const q = byId.get(item.id);
    if (!q) throw new Error(`Model je vratio nepoznat id ${item.id}.`);
    if (typeof item.text !== "string" || item.text.trim() === "") {
      throw new Error(`Pitanje ${item.id}: prazan prevod teksta.`);
    }
    if (hasOptions(q)) {
      const opts = item.options;
      if (!opts) throw new Error(`Pitanje ${item.id}: nedostaju prevodi opcija.`);
      for (const key of OPTION_KEYS) {
        if (typeof opts[key] !== "string" || opts[key].trim() === "") {
          throw new Error(`Pitanje ${item.id}: prazna opcija „${key}".`);
        }
      }
    }
    staged.push([q, item]);
  }

  for (const [q, item] of staged) {
    q[textField] = item.text;
    if (hasOptions(q)) {
      q[optionsField] = { a: item.options.a, b: item.options.b, c: item.options.c };
    }
  }
  return staged.length;
}

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// ── glavni tok ─────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const questions = loadQuestions(args.file);

  if (args.stats) {
    reportStats(questions, Object.keys(LANGS));
    return;
  }

  const fingerprintBefore = answerFingerprint(questions);
  let totalDone = 0;
  let totalFailed = 0;

  const client = args.dryRun ? null : new Anthropic();

  for (const lang of args.langs) {
    const { name: langName } = LANGS[lang];
    const pending = questions.filter((q) => !isTranslated(q, lang)).slice(0, args.limit);

    if (pending.length === 0) {
      console.log(`[${lang}] Sve je već prevedeno — nema šta da se radi.`);
      continue;
    }

    // Pitanja sa opcijama i ordering pitanja idu u odvojene pakete, jer im se
    // razlikuje shema odgovora (ordering nema ponuđene odgovore).
    const withOpts = pending.filter(hasOptions);
    const noOpts = pending.filter((q) => !hasOptions(q));
    const batches = [
      ...chunk(withOpts, args.batch).map((b) => ({ batch: b, withOptions: true })),
      ...chunk(noOpts, args.batch).map((b) => ({ batch: b, withOptions: false })),
    ];

    console.log(
      `[${lang}] ${pending.length} pitanja za prevod u ${batches.length} paketa` +
        ` (${withOpts.length} sa opcijama, ${noOpts.length} bez).`,
    );

    if (args.dryRun) {
      for (const { batch } of batches) {
        console.log(`  paket: ${batch.map((q) => q.id).join(", ")}`);
      }
      continue;
    }

    let index = 0;
    for (const { batch, withOptions } of batches) {
      index += 1;
      const label = `[${lang}] paket ${index}/${batches.length} (id ${batch[0].id}–${batch[batch.length - 1].id})`;
      try {
        const items = await translateBatch(client, {
          model: args.model,
          langName,
          batch,
          withOptions,
        });
        const applied = applyBatch(items, batch, lang);

        if (answerFingerprint(questions) !== fingerprintBefore) {
          fail("Tačni odgovori su se promijenili — prekidam bez upisa.");
        }

        // Upis nakon svakog paketa: prekid (Ctrl+C, pad mreže, potrošen limit)
        // ne baca već obavljen posao.
        saveQuestions(args.file, questions);
        totalDone += applied;
        console.log(`  ${label} — ${applied} prevedeno, upisano.`);
      } catch (err) {
        totalFailed += batch.length;
        console.error(`  ${label} — NEUSPJELO: ${err.message}`);
        console.error("  (paket je preskočen; ponovno pokretanje skripte ga pokušava opet)");
      }
    }
  }

  if (args.dryRun) return;

  console.log("");
  console.log(`Prevedeno u ovom prolazu: ${totalDone} pitanja.`);
  if (totalFailed > 0) {
    console.log(`Neuspjelo: ${totalFailed} pitanja — pokrenite skriptu ponovo za te pakete.`);
  }
  reportStats(loadQuestions(args.file), args.langs);
  console.log("");
  console.log("Ovo je mašinski prevod za pomoć u učenju — zvanični ispit je na crnogorskom.");
  console.log("Prije objave neka izvorni govornik provjeri saobraćajne termine.");
}

// Pokreće se samo kad se skripta zove direktno — da se čiste funkcije mogu
// uvesti i testirati bez ijednog poziva API-ja.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
