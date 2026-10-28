// Browser regressions use isolated contexts and synthetic observations only.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const browser = await chromium.launch();
const base = process.env.CYCLE_URL || "http://127.0.0.1:3217";
const output = process.env.CYCLE_SCREENSHOTS || "/tmp/cycle-v3-browser";
await mkdir(output, { recursive: true });
let checks = 0;
const errors = [];
const hosts = new Set();
const check = (value, message) => {
  assert.ok(value, message);
  checks++;
};
const today = new Date().toLocaleDateString("sv-SE");
const blank = (date, patch = {}) => ({
  date,
  periodFlow: "none",
  moods: [],
  symptoms: [],
  energy: null,
  notes: "",
  createdAt: "2000-01-01T00:00:00.000Z",
  updatedAt: "2000-01-01T00:00:00.000Z",
  ...patch,
});
const data = (logs = {}) => ({
  version: 1,
  onboarding: {
    completed: true,
    lastPeriodStart: today,
    cycleLength: 31,
    periodLength: 6,
  },
  settings: { averageCycleLength: 31, averagePeriodLength: 6 },
  logs,
  imports: { syntheticLegacyImport: "2000-01-01T00:00:00.000Z" },
});
const open = async (context) => {
  const p = await context.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("request", (r) => hosts.add(new URL(r.url()).host));
  await p.goto(base);
  return p;
};
const begin = async (p) => {
  await p.getByRole("button", { name: "Iniziamo", exact: true }).click();
  await p.getByRole("button", { name: "Non lo so", exact: true }).click();
  await p
    .getByRole("button", {
      name: "Non lo so, usa dei valori iniziali",
      exact: true,
    })
    .click();
};
const tab = async (p, name) => {
  await p.getByRole("button", { name, exact: true }).click();
};
const save = async (p) => {
  await tab(p, "Salva giornata");
  await p.getByRole("status").filter({ hasText: "Giornata salvata" }).waitFor();
  await p.getByRole("heading", { name: "Oggi", exact: true }).waitFor();
};
try {
  for (const width of [320, 375, 390, 430, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
    });
    const p = await open(context);
    check(
      await p.getByRole("button", { name: "Ripristina da backup" }).isVisible(),
      `restore at onboarding ${width}`,
    );
    await begin(p);
    await tab(p, "Registra oggi");
    check(
      !(await p.getByRole("button", { name: "Salva giornata" }).isEnabled()),
      "empty check-in disabled",
    );
    await tab(p, "Serena");
    check(
      (await p
        .getByRole("button", { name: "Serena", exact: true })
        .getAttribute("aria-pressed")) === "true",
      "chip selected accessible",
    );
    await tab(p, "Calendario");
    await tab(p, "Registra");
    check(
      (await p
        .getByRole("button", { name: "Serena", exact: true })
        .getAttribute("aria-pressed")) === "true",
      "draft survives navigation",
    );
    await tab(p, "Annulla modifiche");
    check(
      (await p
        .getByRole("button", { name: "Serena", exact: true })
        .getAttribute("aria-pressed")) === "false",
      "draft explicitly cancelled",
    );
    await tab(p, "Serena");
    await save(p);
    const stored = await p.evaluate(() =>
      JSON.parse(localStorage.getItem("cycle.v1")),
    );
    check(stored.logs[today].moods[0] === "serena", "minimal check-in saved");
    check(
      stored.logs[today].flowRecorded === undefined,
      "skipped flow remains unknown",
    );
    for (const name of ["Oggi", "Calendario", "Registra", "Andamento"]) {
      const wasActive =
        (await p
          .getByRole("button", { name, exact: true })
          .getAttribute("aria-current")) === "page";
      await tab(p, name);
      check(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `no overflow ${width} ${name}`,
      );
      if (!wasActive) {
        await p.waitForFunction(() => document.activeElement?.tagName === "H1");
        check(true, `focus ${name}`);
      }
      await p.screenshot({
        path: `${output}/${width}-${name}.png`,
        fullPage: true,
      });
    }
    await tab(p, "Impostazioni");
    check(
      await p.getByRole("button", { name: "Esporta i miei dati" }).isVisible(),
      "stable settings",
    );
    check(
      (await p
        .getByRole("button", { name: "Aumenta Durata di partenza del ciclo" })
        .count()) === 1,
      "specific stepper name",
    );
    await tab(p, "Chiudi");
    await p.reload();
    check(
      await p.getByRole("button", { name: "Aggiorna oggi" }).isVisible(),
      "refresh preserves saved log",
    );
    await context.close();
  }
  // Import before onboarding, including legacy fields, profile and export.
  {
    const c = await browser.newContext();
    const p = await open(c);
    const incoming = data({
      [today]: blank(today, {
        sexualActivity: "recorded",
        notes: "Synthetic backup note",
      }),
    });
    await p.locator("input[type=file]").setInputFiles({
      name: "synthetic-backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          app: "cycle",
          kind: "cycle-backup",
          version: 1,
          data: incoming,
        }),
      ),
    });
    await tab(p, "Importa mantenendo i dati locali");
    await p.getByRole("heading", { name: "Oggi", exact: true }).waitFor();
    const stored = await p.evaluate(() =>
      JSON.parse(localStorage.getItem("cycle.v1")),
    );
    check(stored.settings.averageCycleLength === 31, "profile restored");
    check(
      stored.logs[today].sexualActivity === "recorded",
      "legacy sexual data retained",
    );
    await tab(p, "Impostazioni");
    const [download] = await Promise.all([
      p.waitForEvent("download"),
      tab(p, "Esporta i miei dati"),
    ]);
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const exported = JSON.parse(Buffer.concat(chunks));
    check(
      exported.data.logs[today].notes === "Synthetic backup note",
      "export round trip",
    );
    const conflict = data({
      [today]: blank(today, { notes: "Synthetic conflicting note", energy: 4 }),
    });
    await p.locator("input[type=file]").setInputFiles({
      name: "synthetic-conflict.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(conflict)),
    });
    await tab(p, "Importa mantenendo i dati locali");
    const merged = await p.evaluate(() =>
      JSON.parse(localStorage.getItem("cycle.v1")),
    );
    check(
      merged.logs[today].notes === "Synthetic backup note",
      "local conflict preserved",
    );
    check(
      merged.backupConflicts[today][0].notes === "Synthetic conflicting note",
      "alternate conflict preserved",
    );
    await c.close();
  }
  // Personal observations: distributed synthetic cycles, evidence and day navigation.
  {
    const c = await browser.newContext();
    const p = await c.newPage();
    const logs = {};
    for (let cycle = 0; cycle < 5; cycle++) {
      const startDate = new Date(today + "T12:00:00");
      startDate.setDate(startDate.getDate() - 28 * (4 - cycle));
      const start = startDate.toLocaleDateString("sv-SE");
      logs[start] = blank(start, { periodFlow: "light" });
      if (cycle < 4)
        for (let day = 1; day <= 6; day++) {
          const d = new Date(startDate);
          d.setDate(d.getDate() + day);
          const key = d.toLocaleDateString("sv-SE");
          logs[key] = blank(key, {
            symptomsRecorded: true,
            symptoms: day === 2 ? ["crampi"] : [],
          });
        }
    }
    await p.addInitScript(
      (d) => localStorage.setItem("cycle.v1", JSON.stringify(d)),
      data(logs),
    );
    await p.goto(base);
    await p.getByText(/Hai registrato “Crampi” in 4/).waitFor();
    check(true, "personal home observation");
    await tab(p, "Andamento");
    await p.getByText("Su cosa si basa?", { exact: true }).click();
    check(
      (await p.locator("details").innerText()).includes("4 cicli"),
      "insight evidence explains cycles",
    );
    const evidenceDay = p.locator("details button").first();
    await evidenceDay.click();
    check(
      (await p
        .getByRole("button", { name: "Calendario", exact: true })
        .getAttribute("aria-current")) === "page",
      "insight opens relevant calendar day",
    );
    await c.close();
  }
  // Failed writes keep draft and never show success.
  {
    const c = await browser.newContext();
    const p = await open(c);
    await begin(p);
    await tab(p, "Registra");
    await tab(p, "Serena");
    await p.evaluate(() => {
      window.__originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function () {
        throw Error("simulated");
      };
    });
    await tab(p, "Salva giornata");
    check(
      await p
        .locator("[role=alert]:not(#__next-route-announcer__)")
        .isVisible(),
      "storage failure announced",
    );
    check(
      !(await p.getByText("Giornata salvata", { exact: true }).count()),
      "no false success",
    );
    check(
      (await p
        .getByRole("button", { name: "Serena", exact: true })
        .getAttribute("aria-pressed")) === "true",
      "draft retained after failure",
    );
    await p.evaluate(
      () => (Storage.prototype.setItem = window.__originalSetItem),
    );
    await save(p);
    await c.close();
  }
  // Existing legacy storage is not rewritten on hydration.
  {
    const c = await browser.newContext();
    const p = await c.newPage();
    const original = JSON.stringify(
      data({ [today]: blank(today, { sexualActivity: "recorded" }) }),
    );
    await p.addInitScript(
      (value) => localStorage.setItem("cycle.v1", value),
      original,
    );
    await p.goto(base);
    await p.getByRole("heading", { name: "Oggi", exact: true }).waitFor();
    check(
      (await p.evaluate(() => localStorage.getItem("cycle.v1"))) === original,
      "legacy payload untouched at hydration",
    );
    await c.close();
  }
  // Multi-tab different days and same-day draft conflicts.
  {
    const c = await browser.newContext();
    const p = await open(c);
    await begin(p);
    const q = await open(c);
    await tab(p, "Registra");
    await tab(p, "Serena");
    await tab(q, "Registra");
    await q.getByRole("button", { name: "Energia 4 — Buona" }).click();
    await save(q);
    await tab(p, "Salva giornata");
    await p.locator("[role=alert]:not(#__next-route-announcer__)").waitFor();
    check(
      (
        await p
          .locator("[role=alert]:not(#__next-route-announcer__)")
          .innerText()
      ).includes("altra scheda"),
      "same-day multi-tab conflict blocked",
    );
    check(
      (await p.evaluate(() => JSON.parse(localStorage.getItem("cycle.v1"))))
        .logs[today].energy === 4,
      "newer same-day data not overwritten",
    );
    await p.getByText("Controlla la giornata salvata", { exact: true }).click();
    p.once("dialog", (d) => d.accept());
    await tab(p, "Salva la bozza conservando l’altra versione");
    await p.getByText("Giornata salvata", { exact: true }).waitFor();
    check(
      (await p.evaluate(() => JSON.parse(localStorage.getItem("cycle.v1"))))
        .backupConflicts[today][0].energy === 4,
      "multi-tab alternative retained",
    );
    await p.getByRole("heading", { name: "Oggi", exact: true }).waitFor();
    await tab(q, "Calendario");
    const yesterdayDate = new Date(today + "T12:00:00");
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = yesterdayDate.toLocaleDateString("sv-SE");
    const dayLabel = yesterdayDate.toLocaleDateString("it-IT", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    await q.getByRole("button", { name: new RegExp("^" + dayLabel) }).click();
    await tab(q, "Registra questo giorno");
    await q.getByRole("button", { name: "Energia 2 — Bassa" }).click();
    await tab(q, "Salva giornata");
    await q.getByText("Giornata salvata", { exact: true }).waitFor();
    await p.reload();
    const combined = await p.evaluate(() =>
      JSON.parse(localStorage.getItem("cycle.v1")),
    );
    check(
      combined.logs[today].moods.includes("serena") &&
        combined.logs[yesterday].energy === 2,
      "multi-tab writes to different days both retained",
    );
    await c.close();
  }
  // Corrupt storage remains byte-for-byte recoverable.
  {
    const c = await browser.newContext();
    const p = await c.newPage();
    await p.addInitScript(() =>
      localStorage.setItem("cycle.v1", "{synthetic-broken"),
    );
    await p.goto(base);
    await p
      .getByRole("heading", { name: "Il tuo diario è da recuperare" })
      .waitFor();
    check(
      (await p.evaluate(() => localStorage.getItem("cycle.v1"))) ===
        "{synthetic-broken",
      "corrupt original preserved",
    );
    check(
      await p
        .getByRole("button", { name: "Esporta il dato originale" })
        .isVisible(),
      "corrupt export available",
    );
    await c.close();
  }
  // Offline shell, including a refresh after onboarding.
  {
    const c = await browser.newContext();
    const p = await open(c);
    await begin(p);
    await p.evaluate(() => navigator.serviceWorker.ready);
    await p.reload();
    await c.setOffline(true);
    await p.reload();
    await tab(p, "Calendario");
    check(
      await p.getByRole("heading", { level: 1 }).isVisible(),
      "offline calendar",
    );
    await tab(p, "Registra");
    await tab(p, "Nessun sintomo");
    await save(p);
    check(
      (await p.evaluate(() => JSON.parse(localStorage.getItem("cycle.v1"))))
        .logs[today].symptomsRecorded,
      "offline persistence",
    );
    await c.close();
  }
  check(errors.length === 0, `no browser errors: ${errors.join("; ")}`);
  check(
    [...hosts].every((h) => h === new URL(base).host),
    `no external requests: ${[...hosts].join(",")}`,
  );
  console.log(
    JSON.stringify(
      {
        passed: checks,
        widths: [320, 375, 390, 430, 1440],
        pageErrors: errors,
        hosts: [...hosts],
        screenshots: output,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
