// Isolated synthetic profile, dated relative to the REAL day in Europe/Rome.
// Never reads an existing browser profile or a user's production storage.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { computeCycle } = require("../.test-build/lib/cycle.js");
const { addDays, formatRange } = require("../.test-build/lib/dates.js");
const pw = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const engine = process.env.CYCLE_BROWSER || "chromium";
const browser = await pw[engine].launch();
const base = process.env.CYCLE_URL || "http://127.0.0.1:3217";
const output = process.env.CYCLE_SCREENSHOTS || "/tmp/cycle-state-regression";
await mkdir(output, { recursive: true });
const today = new Date().toLocaleDateString("sv-SE", {
  timeZone: "Europe/Rome",
});
const ISO = "2000-01-01T00:00:00.000Z";
const log = (date, patch = {}) => ({
  date,
  periodFlow: "none",
  moods: [],
  symptoms: [],
  energy: null,
  notes: "",
  createdAt: ISO,
  updatedAt: ISO,
  ...patch,
});
const fixture = {
  version: 1,
  onboarding: {
    completed: true,
    lastPeriodStart: null,
    cycleLength: 28,
    periodLength: 5,
  },
  settings: { averageCycleLength: 28, averagePeriodLength: 5 },
  logs: {},
  imports: { syntheticRegression: ISO },
};
for (const offset of [102, 74, 46, 18]) {
  const start = addDays(today, -offset);
  for (let d = 0; d < 5; d++) {
    const date = addDays(start, d);
    fixture.logs[date] = log(date, { periodFlow: "medium" });
  }
  const end = addDays(start, 5);
  fixture.logs[end] = log(end, { flowRecorded: true });
}
fixture.logs[today] = log(today, {
  energy: 4,
  notes: "Synthetic existing daily note",
  sexualActivity: "recorded",
});
const errors = [];
const hosts = new Set();
let passed = 0;
const check = (value, message) => {
  assert.ok(value, message);
  passed++;
};
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  timezoneId: "Europe/Rome",
  reducedMotion: "reduce",
});
try {
  await context.addInitScript((data) => {
    if (!localStorage.getItem("cycle.v1"))
      localStorage.setItem("cycle.v1", JSON.stringify(data));
  }, fixture);
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => hosts.add(new URL(r.url()).host));
  await page.goto(base);
  const primary = page.locator('[aria-label="Stato attuale del ciclo"]');
  await primary.waitFor();
  check(
    (await primary.getAttribute("data-cycle-state")) === "fertile-estimated",
    "real today is initially estimated fertile",
  );
  check(
    (await primary.innerText()).includes("Finestra fertile stimata"),
    "initial fertile state visible",
  );
  check(
    (await page.evaluate(() => localStorage.getItem("cycle.v1"))) ===
      JSON.stringify(fixture),
    "legacy hydration does not rewrite storage",
  );
  await page.screenshot({
    path: `${output}/${engine}-before-real-flow.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Registra", exact: true }).tap();
  await page.getByRole("button", { name: "Medio", exact: true }).tap();
  await page.getByRole("button", { name: "Salva giornata", exact: true }).tap();
  await page
    .getByRole("status")
    .filter({ hasText: "Giornata salvata" })
    .waitFor();
  await page.getByRole("heading", { name: "Oggi", exact: true }).waitFor();
  check(
    (await primary.getAttribute("data-cycle-state")) ===
      "menstruation-recorded",
    "new flow immediately replaces fertile state",
  );
  check(
    (await primary.getAttribute("data-source")) === "recorded",
    "main state explicitly sourced from observation",
  );
  check(
    (await primary.innerText()).includes("Mestruazioni"),
    "main state is menstruation",
  );
  check(
    !/fertile|ovulazione|follicolare|luteale/i.test(await primary.innerText()),
    "no competing primary estimate",
  );
  check(
    (await page
      .getByRole("img", { name: "Giorno 1 del ciclo", exact: true })
      .count()) === 1,
    "ring resets to day 1",
  );
  check(
    (await page.getByText(/Durata abituale: circa 5 giorni/).count()) === 1,
    "duration still reflects complete five-day episodes",
  );
  const persisted = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("cycle.v1")),
  );
  for (const [date, entry] of Object.entries(fixture.logs))
    if (date !== today) assert.deepEqual(persisted.logs[date], entry);
  passed++;
  check(
    persisted.version === 1 && persisted.logs[today].periodFlow === "medium",
    "same v1 schema persists real flow",
  );
  check(
    persisted.logs[today].notes === fixture.logs[today].notes &&
      persisted.logs[today].energy === 4 &&
      persisted.logs[today].sexualActivity === "recorded",
    "editing flow retains existing daily information",
  );
  const computed = computeCycle({ logs: persisted.logs, today });
  check(
    computed.currentCycleStart === today && computed.currentCycleDay === 1,
    "real new start is the shared origin",
  );
  check(
    computed.averagePeriodLength === 5 &&
      computed.periods.at(-1).status === "ongoing",
    "new one-day episode excluded from duration mean",
  );
  check(
    computed.fertileWindow.start > today && computed.ovulation.start > today,
    "fertility and ovulation fully recalculated into future",
  );
  await page
    .getByRole("button", { name: "Approfondimenti", exact: true })
    .tap();
  check(
    (await page.locator("body").innerText()).includes(
      `Finestra fertile stimata ${formatRange(computed.fertileWindow.start, computed.fertileWindow.end)}`,
    ),
    "secondary fertility dates match new origin",
  );
  await page.screenshot({
    path: `${output}/${engine}-after-real-flow.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Calendario", exact: true }).tap();
  const recorded = page.locator(`button[data-date="${today}"]`);
  check(
    (await recorded.getAttribute("data-cycle-state")) ===
      "menstruation-recorded",
    "calendar agrees with Home",
  );
  check(
    (await recorded.getAttribute("data-period")) === "true" &&
      (await recorded.getAttribute("data-fertile")) === null,
    "today is recorded menstruation, never fertile",
  );
  check(
    !/fertile|ovulazione/i.test(await recorded.getAttribute("aria-label")),
    "today has no contradictory calendar announcement",
  );
  const detail = page.locator('section[aria-label="Dettaglio giorno"]');
  check(
    (await detail.getAttribute("data-cycle-state")) ===
      "menstruation-recorded" &&
      (await detail.innerText()).includes("Giorno 1"),
    "selected day agrees too",
  );
  await page.screenshot({
    path: `${output}/${engine}-calendar-observed.png`,
    fullPage: true,
  });
  async function reveal(date) {
    for (
      let i = 0;
      i < 3 && !(await page.locator(`button[data-date="${date}"]`).count());
      i++
    )
      await page.getByRole("button", { name: "Mese successivo" }).tap();
    return page.locator(`button[data-date="${date}"]`);
  }
  for (let d = 1; d < 5; d++) {
    const date = addDays(today, d);
    const button = await reveal(date);
    check(
      (await button.getAttribute("data-estimated-period")) === "true" &&
        (await button.getAttribute("data-period")) === null,
      `day +${d} expected, not recorded`,
    );
    check(
      (await button.getAttribute("data-source")) === "estimated",
      `day +${d} estimate provenance`,
    );
    check(
      persisted.logs[date] === undefined,
      `day +${d} not invented in storage`,
    );
  }
  const future = await reveal(computed.fertileWindow.start);
  check(
    (await future.getAttribute("data-fertile")) === "true" &&
      (await future.getAttribute("data-source")) === "estimated",
    "future calendar fertility belongs to new cycle",
  );
  await page.getByRole("button", { name: "Andamento", exact: true }).tap();
  const insightState = page.locator(
    '[aria-label="Stato del ciclo negli andamenti"]',
  );
  check(
    (await insightState.getAttribute("data-cycle-state")) ===
      "menstruation-recorded" &&
      (await insightState.innerText()).includes("Giorno 1"),
    "Insights agrees with Home and Calendar",
  );
  const mean = await page
    .getByText("Durata media delle mestruazioni", { exact: true })
    .locator("..")
    .innerText();
  check(mean.includes("5 giorni"), "statistics retain duration average");
  await page.getByRole("button", { name: "Oggi", exact: true }).tap();
  const rawBeforeReload = await page.evaluate(() =>
    localStorage.getItem("cycle.v1"),
  );
  await page.reload();
  await primary.waitFor();
  check(
    (await primary.getAttribute("data-cycle-state")) ===
      "menstruation-recorded" &&
      (await page
        .getByRole("img", { name: "Giorno 1 del ciclo", exact: true })
        .count()) === 1,
    "refresh retains menstruation day 1",
  );
  check(
    (await page.evaluate(() => localStorage.getItem("cycle.v1"))) ===
      rawBeforeReload,
    "refresh leaves legacy and new persisted data intact",
  );
  check(errors.length === 0, `no browser errors: ${errors.join(";")}`);
  check(
    [...hosts].every((host) => host === new URL(base).host),
    "no external services requested",
  );
  console.log(
    JSON.stringify(
      {
        engine,
        today,
        passed,
        source: base,
        pageErrors: errors,
        screenshots: output,
      },
      null,
      2,
    ),
  );
} finally {
  await context.close();
  await browser.close();
}
