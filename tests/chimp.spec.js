const fs = require("fs");
const path = require("path");
const { test, expect } = require("@playwright/test");

const FAST = "readyMs=40&feedbackMs=40&revealMs=40&test=1";

async function getLayouts(page) {
  await page.waitForFunction(() => window.chimpTaskDebug);
  return page.evaluate(() => window.chimpTaskDebug);
}

async function tapCells(page, cells) {
  await page.locator("#chimp-grid").waitFor();
  for (const cell of cells) {
    await page.locator(`.chimp-tile[data-cell="${cell}"]`).click();
  }
}

// first tap on the tile holding 2, so the round fails at once
async function failRound(page, layout) {
  await tapCells(page, [layout[1]]);
}

async function startTask(page, practice) {
  await page.getByRole("button", { name: "Start practice" }).click();
  await tapCells(page, practice);
  await expect(page.locator(".chimp-feedback-correct")).toHaveText("Correct!");
  await page.getByRole("button", { name: "Begin the task" }).click();
}

test("discontinues after both rounds at a length are wrong and scores span", async ({ page }) => {
  await page.goto(`/qualtrics-v7/chimp-preview.html?${FAST}&seed=span4`);
  const lay = await getLayouts(page);

  await page.getByRole("button", { name: "Start practice" }).click();
  await page.locator("#chimp-grid").waitFor();
  await expect(page.locator(".chimp-tile-number").first()).toBeVisible();

  // tapping 1 hides the other numbers but leaves their tiles tappable
  await tapCells(page, [lay.practice[0]]);
  await expect(page.locator("#chimp-grid")).toHaveClass(/chimp-hidden/);
  await expect(page.locator(`.chimp-tile[data-cell="${lay.practice[1]}"] .chimp-tile-number`)).toBeHidden();
  await expect(page.locator(`.chimp-tile[data-cell="${lay.practice[1]}"]`)).toBeVisible();
  await tapCells(page, lay.practice.slice(1));
  await expect(page.locator(".chimp-feedback-correct")).toHaveText("Correct!");
  await page.getByRole("button", { name: "Begin the task" }).click();

  await tapCells(page, lay.main["4"][0]);
  const m = lay.main["4"][1];
  await tapCells(page, [m[0], m[1], m[3]]);
  await failRound(page, lay.main["5"][0]);
  await failRound(page, lay.main["5"][1]);

  await expect(page.locator("#chimp-span-score")).toHaveText("4");
  await page.getByRole("button", { name: "Finish preview" }).click();

  const run = await page.evaluate(() => window.chimpTaskLastRun);
  expect(run.span).toBe(4);
  expect(run.total_correct).toBe(1);
  expect(run.trials_completed).toBe(4);
  expect(run.max_length_reached).toBe(5);
  expect(run.summary.discontinued).toBe(1);
  expect(run.practice).toHaveLength(1);
  expect(run.practice[0]).toMatchObject({ correct: 1, n_correct_before_error: 3, hidden_by: "tap" });
  expect(run.trials[0]).toMatchObject({
    length: 4,
    trial_in_length: 1,
    layout: lay.main["4"][0],
    taps: lay.main["4"][0],
    correct: 1,
    n_correct_before_error: 4,
  });
  expect(run.trials[1]).toMatchObject({ correct: 0, n_correct_before_error: 2, taps: [m[0], m[1], m[3]] });
  expect(run.trials[2]).toMatchObject({ correct: 0, n_correct_before_error: 0 });
  expect(typeof run.trials[0].study_ms).toBe("number");
  expect(typeof run.trials[0].rt_ms).toBe("number");
  expect(run.summary.by_length["5"]).toEqual({ attempted: 2, correct: 0 });
  await expect(page.locator("#summary_panel")).toBeVisible();
});

test("all rounds correct runs every length and gives span 12", async ({ page }) => {
  await page.goto(`/qualtrics-v7/chimp-preview.html?${FAST}&feedback=0&seed=allcorrect`);
  const lay = await getLayouts(page);
  await startTask(page, lay.practice);

  for (let length = 4; length <= 12; length++) {
    for (const layout of lay.main[String(length)]) {
      expect(layout).toHaveLength(length);
      expect(new Set(layout).size).toBe(length);
      expect(layout.every((c) => c >= 0 && c < 40)).toBe(true);
      await tapCells(page, layout);
    }
  }

  await expect(page.locator("#chimp-span-score")).toHaveText("12");
  await page.getByRole("button", { name: "Finish preview" }).click();
  const run = await page.evaluate(() => window.chimpTaskLastRun);
  expect(run.span).toBe(12);
  expect(run.total_correct).toBe(18);
  expect(run.trials_completed).toBe(18);
  expect(run.summary.discontinued).toBe(0);
});

test("a wrong tap ends the round and reveals the numbers", async ({ page }) => {
  await page.goto(`/qualtrics-v7/chimp-preview.html?readyMs=40&feedbackMs=40&revealMs=1500&test=1&seed=wrong`);
  const lay = await getLayouts(page);
  await page.getByRole("button", { name: "Start practice" }).click();
  await tapCells(page, [lay.practice[0], lay.practice[2]]);

  await expect(page.locator("#chimp-grid")).toHaveClass(/chimp-reveal/);
  await expect(page.locator(`.chimp-tile[data-cell="${lay.practice[2]}"]`)).toHaveClass(/chimp-tile-wrong/);
  await expect(page.locator(`.chimp-tile[data-cell="${lay.practice[1]}"] .chimp-tile-number`)).toBeVisible();
  await expect(page.locator(".chimp-feedback-wrong")).toHaveText("Not quite.");
});

test("exposureMs hides the numbers on a timer", async ({ page }) => {
  await page.goto(`/qualtrics-v7/chimp-preview.html?${FAST}&exposureMs=200&maxLength=4&seed=timer`);
  const lay = await getLayouts(page);
  await page.getByRole("button", { name: "Start practice" }).click();
  await page.locator("#chimp-grid").waitFor();
  await expect(page.locator("#chimp-grid")).toHaveClass(/chimp-hidden/);
  await tapCells(page, lay.practice);
  await page.getByRole("button", { name: "Begin the task" }).click();
  await failRound(page, lay.main["4"][0]);
  await failRound(page, lay.main["4"][1]);
  await page.getByRole("button", { name: "Finish preview" }).click();
  const run = await page.evaluate(() => window.chimpTaskLastRun);
  expect(run.practice[0]).toMatchObject({ correct: 1, hidden_by: "timer" });
  expect(run.summary.settings.exposureMs).toBe(200);
});

for (const size of [
  { name: "phone", width: 375, height: 812, grid: "5x8" },
  { name: "laptop", width: 1280, height: 800, grid: "8x5" },
]) {
  test(`grid fits the ${size.name} screen as ${size.grid}`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.goto(`/qualtrics-v7/chimp-preview.html?${FAST}&seed=layout`);
    await page.getByRole("button", { name: "Start practice" }).click();
    const grid = page.locator("#chimp-grid");
    await expect(grid).toHaveAttribute("data-grid", size.grid);
    const box = await grid.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(size.width);
    expect(box.y + box.height).toBeLessThanOrEqual(size.height);
    // tiles should be big enough to tap on a phone
    const tile = await page.locator(".chimp-tile").first().boundingBox();
    expect(tile.width).toBeGreaterThanOrEqual(44);
  });
}

test("Qualtrics wrapper loads hosted assets and writes all chimp_ Embedded Data", async ({ page }) => {
  // serve the absolute GitHub Pages URLs from the local checkout
  await page.route("https://wrayo.github.io/stm-jspsych/**", async (route) => {
    const url = new URL(route.request().url());
    const localPath = url.pathname.replace(/^\/stm-jspsych/, "");
    if (localPath.endsWith("/chimp-v7-task.js")) {
      const body = fs.readFileSync(path.join(__dirname, "..", localPath), "utf8");
      const speedUp =
        "Object.assign(window.chimpTaskConfig, {readyMs: 40, feedbackMs: 40, revealMs: 40, seed: 'mock', exposeSequences: true});\n";
      await route.fulfill({ contentType: "application/javascript", body: speedUp + body });
      return;
    }
    await route.fulfill({ path: path.join(__dirname, "..", localPath) });
  });

  await page.goto("/tests/fixtures/qualtrics-mock.html?task=chimp");
  await expect.poll(() => page.evaluate(() => window.__nextHidden)).toBe(true);
  const lay = await getLayouts(page);

  await startTask(page, lay.practice);
  await failRound(page, lay.main["4"][0]);
  await failRound(page, lay.main["4"][1]);
  await expect(page.locator("#chimp-span-score")).toHaveText("0");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect.poll(() => page.evaluate(() => window.__nextClicked)).toBe(true);
  const ed = await page.evaluate(() => window.__embeddedData);
  expect(Object.keys(ed).sort()).toEqual(
    [
      "chimp_device_touch",
      "chimp_duration_ms",
      "chimp_max_length_reached",
      "chimp_participant_id",
      "chimp_practice_json",
      "chimp_span",
      "chimp_summary_json",
      "chimp_total_correct",
      "chimp_trials_completed",
      "chimp_trials_json",
    ]
  );
  expect(ed.chimp_span).toBe("0");
  expect(ed.chimp_trials_completed).toBe("2");
  expect(JSON.parse(ed.chimp_trials_json)).toHaveLength(2);
  expect(JSON.parse(ed.chimp_summary_json).discontinued).toBe(1);
  await expect(page.locator("#display_stage")).toHaveCount(0);
});

test("Chimp_Task.qsf is import-ready and points at the hosted assets", () => {
  const qsf = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../qualtrics-v7/Chimp_Task.qsf"), "utf8")
  );
  const questions = qsf.SurveyElements.filter((e) => e.Element === "SQ");
  const taskQuestion = questions.find((e) => e.PrimaryAttribute === "QID2");
  const flow = qsf.SurveyElements.find((e) => e.Element === "FL").Payload.Flow;
  const embeddedData = flow.find((item) => item.Type === "EmbeddedData").EmbeddedData;

  expect(qsf.SurveyEntry.SurveyName).toBe("Number Grid Memory");
  expect(questions).toHaveLength(3);
  expect(flow.map((item) => item.Type)).toEqual(["Block", "EmbeddedData", "Standard", "Standard"]);
  expect(embeddedData.map((f) => f.Field)).toHaveLength(10);
  expect(embeddedData.every((f) => f.Field.startsWith("chimp_"))).toBe(true);
  expect(taskQuestion.Payload.QuestionJS).toContain('"https://wrayo.github.io/stm-jspsych"');
  expect(taskQuestion.Payload.QuestionJS).toContain('assetBaseUrl + "/chimp-v7-task.js"');
  expect(taskQuestion.Payload.QuestionText).toContain("chimp-load-status");
  expect(JSON.stringify(qsf)).not.toMatch(/animals|stm_|digit/i);
});
