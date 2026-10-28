// Synthetic history and an isolated, fixed clock; never reads a user's profile.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const pw = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const engine = process.env.CYCLE_BROWSER || "chromium";
const browser = await pw[engine].launch();
const base = process.env.CYCLE_URL || "http://127.0.0.1:3217";
const output = "/tmp/cycle-mobile-calendar";
await mkdir(output, { recursive: true });
let passed = 0;
const check = (condition, message) => {
  assert.ok(condition, message);
  passed++;
};
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
};
for (const date of ["2000-01-01", "2000-01-29", "2000-02-26"])
  fixture.logs[date] = {
    date,
    periodFlow: "medium",
    energy: null,
    moods: [],
    symptoms: [],
    notes: "",
    createdAt: "2000-01-01T00:00:00.000Z",
    updatedAt: "2000-01-01T00:00:00.000Z",
  };
try {
  for (const width of [320, 375, 390, 430]) {
    const c = await browser.newContext({
      viewport: { width, height: 844 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
      timezoneId: "Europe/Rome",
      reducedMotion: "reduce",
    });
    await c.clock.install({ time: new Date("2000-03-05T12:00:00+01:00") });
    const page = await c.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript((d) => {
      if (!localStorage.getItem("cycle.v1"))
        localStorage.setItem("cycle.v1", JSON.stringify(d));
    }, fixture);
    await page.goto(base);
    await page
      .getByRole("button", { name: "Calendario", exact: true })
      .waitFor();
    check(
      !(await page
        .getByRole("heading", { name: "Il tuo ciclo, con calma", exact: true })
        .count()),
      "no slogan",
    );
    await page.getByRole("button", { name: "Calendario", exact: true }).tap();
    const fertile = page.getByRole("button", {
      name: /^10 marzo 2000,.*finestra fertile stimata/,
    });
    check((await fertile.count()) === 1, "fertility visible by default");
    await fertile.tap();
    check(
      (await fertile.getAttribute("aria-pressed")) === "true",
      "day selectable with touch",
    );
    check(
      (await page
        .getByText("Finestra fertile stimata", { exact: true })
        .count()) > 0,
      "fertility legend/details",
    );
    await page.waitForFunction(
      () =>
        document
          .querySelector('section[aria-label="Dettaglio giorno"]')
          .getBoundingClientRect().top <
        innerHeight - 120,
    );
    check(true, "selected day detail brought into view");
    const size = await fertile.boundingBox();
    check(size.width >= 34 && size.height >= 40, "usable mobile date target");
    await page.getByRole("button", { name: "Mese successivo" }).tap();
    await page
      .getByRole("heading", { name: "Aprile 2000", exact: true })
      .waitFor();
    check(
      (
        await page.locator('section[aria-label="Dettaglio giorno"]').innerText()
      ).includes("10 aprile"),
      "selected detail follows visible month",
    );
    await page.getByRole("button", { name: "Mese precedente" }).tap();
    await page
      .getByRole("heading", { name: "Marzo 2000", exact: true })
      .waitFor();
    check(
      (
        await page.locator('section[aria-label="Dettaglio giorno"]').innerText()
      ).includes("10 marzo"),
      "previous month selection coherent",
    );
    await page.getByRole("button", { name: /^10 marzo 2000,/ }).tap();
    await page.getByRole("button", { name: "Mese successivo" }).tap();
    await page.getByRole("button", { name: "Torna a oggi", exact: true }).tap();
    check(
      (await page
        .getByRole("button", { name: /^5 marzo 2000,/ })
        .getAttribute("aria-pressed")) === "true",
      "today shortcut restores selection",
    );
    check(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "no horizontal overflow",
    );
    await page.screenshot({
      path: `${output}/${engine}-${width}-calendar.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: /^31 marzo 2000/ }).tap();
    await page.getByRole("button", { name: "Mese precedente" }).tap();
    check(
      (await page
        .getByRole("button", { name: /^29 febbraio 2000/ })
        .getAttribute("aria-pressed")) === "true",
      "shorter month clamps selected day, including leap February",
    );
    check(
      (
        await page.locator('section[aria-label="Dettaglio giorno"]').innerText()
      ).includes("29 febbraio"),
      "detail never points to an invalid date",
    );
    await page.getByRole("button", { name: "Oggi", exact: true }).tap();
    await page.screenshot({
      path: `${output}/${engine}-${width}-home.png`,
      fullPage: true,
    });
    check(errors.length === 0, "no mobile runtime errors");
    check(
      (await page.evaluate(() => JSON.parse(localStorage.getItem("cycle.v1"))))
        .logs["2000-01-01"].periodFlow === "medium",
      "saved history untouched",
    );
    await c.close();
  }
  console.log(
    JSON.stringify(
      { engine, passed, widths: [320, 375, 390, 430], screenshots: output },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
