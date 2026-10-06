const fs = require("fs");
const path = require("path");
const { test, expect } = require("@playwright/test");

const FAST = "digitMs=30&blankMs=10&readyMs=40&feedbackMs=40&test=1";

async function enterOnKeypad(page, digits) {
  await page.locator(".stm-keypad").waitFor();
  await expect(page.locator(".stm-key-done")).toBeDisabled();
  for (const digit of digits) {
    await page.locator(`.stm-key[data-key="${digit}"]`).click();
  }
  await page.locator(".stm-key-done").click();
}

// a response that is guaranteed wrong for the given sequence
function wrongFor(sequence) {
  return sequence[0] === "1" ? "2" : "1";
}

async function getSequences(page) {
  await page.waitForFunction(() => window.stmTaskDebug);
  return page.evaluate(() => window.stmTaskDebug);
}

test("discontinues after both lists at a length are wrong and scores span", async ({ page }) => {
  await page.goto(`/qualtrics-v7/preview.html?${FAST}&seed=span3`);
  const seq = await getSequences(page);

  await page.getByRole("button", { name: "Start practice" }).click();

  // practice via the physical keyboard: one wrong digit, Backspace, then the right digits, Enter
  await page.locator(".stm-keypad").waitFor();
  await page.keyboard.press(wrongFor(seq.practice));
  await page.keyboard.press("Backspace");
  for (const digit of seq.practice) {
    await page.keyboard.press(digit);
  }
  await page.keyboard.press("Enter");

  await expect(page.locator(".stm-feedback-correct")).toHaveText("Correct!");
  await page.getByRole("button", { name: "Begin the task" }).click();

  await enterOnKeypad(page, seq.main["3"][0]);
  await enterOnKeypad(page, wrongFor(seq.main["3"][1]));
  await enterOnKeypad(page, wrongFor(seq.main["4"][0]));
  await enterOnKeypad(page, wrongFor(seq.main["4"][1]));

  await expect(page.locator("#stm-span-score")).toHaveText("3");
  await page.getByRole("button", { name: "Finish preview" }).click();

  const run = await page.evaluate(() => window.stmTaskLastRun);
  expect(run.span).toBe(3);
  expect(run.total_correct).toBe(1);
  expect(run.trials_completed).toBe(4);
  expect(run.max_length_reached).toBe(4);
  expect(run.summary.discontinued).toBe(1);
  expect(run.practice).toHaveLength(1);
  expect(run.practice[0]).toMatchObject({ correct: 1, edits: 1, response: seq.practice });
  expect(run.trials[0]).toMatchObject({
    length: 3,
    trial_in_length: 1,
    sequence: seq.main["3"][0],
    correct: 1,
    positions_correct: 3,
  });
  expect(typeof run.trials[0].rt_ms).toBe("number");
  expect(run.summary.by_length["4"]).toEqual({ attempted: 2, correct: 0 });
  await expect(page.locator("#summary_panel")).toBeVisible();
});

test("all lists correct runs every length and gives span 10", async ({ page }) => {
  await page.goto(`/qualtrics-v7/preview.html?${FAST}&feedback=0&seed=allcorrect`);
  const seq = await getSequences(page);

  await page.getByRole("button", { name: "Start practice" }).click();
  await enterOnKeypad(page, seq.practice);
  await page.getByRole("button", { name: "Begin the task" }).click();

  for (let length = 3; length <= 10; length++) {
    for (const sequence of seq.main[String(length)]) {
      expect(sequence).toHaveLength(length);
      expect(sequence).not.toMatch(/(\d)\1/);
      await enterOnKeypad(page, sequence);
    }
  }

  await expect(page.locator("#stm-span-score")).toHaveText("10");
  await page.getByRole("button", { name: "Finish preview" }).click();
  const run = await page.evaluate(() => window.stmTaskLastRun);
  expect(run.span).toBe(10);
  expect(run.total_correct).toBe(16);
  expect(run.trials_completed).toBe(16);
  expect(run.summary.discontinued).toBe(0);
});

test("Qualtrics wrapper loads hosted assets and writes all stm_ Embedded Data", async ({ page }) => {
  // serve the absolute GitHub Pages URLs from the local checkout
  await page.route("https://wrayo.github.io/stm-jspsych/**", async (route) => {
    const url = new URL(route.request().url());
    const localPath = url.pathname.replace(/^\/stm-jspsych/, "");
    if (localPath.endsWith("/stm-v7-task.js")) {
      const body = fs.readFileSync(path.join(__dirname, "..", localPath), "utf8");
      const speedUp =
        "Object.assign(window.stmTaskConfig, {digitMs: 30, blankMs: 10, readyMs: 40, feedbackMs: 40, seed: 'mock', exposeSequences: true});\n";
      await route.fulfill({ contentType: "application/javascript", body: speedUp + body });
      return;
    }
    await route.fulfill({ path: path.join(__dirname, "..", localPath) });
  });

  await page.goto("/tests/fixtures/qualtrics-mock.html");
  await expect.poll(() => page.evaluate(() => window.__nextHidden)).toBe(true);
  const seq = await getSequences(page);

  await page.getByRole("button", { name: "Start practice" }).click();
  await enterOnKeypad(page, seq.practice);
  await page.getByRole("button", { name: "Begin the task" }).click();
  await enterOnKeypad(page, wrongFor(seq.main["3"][0]));
  await enterOnKeypad(page, wrongFor(seq.main["3"][1]));
  await expect(page.locator("#stm-span-score")).toHaveText("0");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect.poll(() => page.evaluate(() => window.__nextClicked)).toBe(true);
  const ed = await page.evaluate(() => window.__embeddedData);
  expect(Object.keys(ed).sort()).toEqual(
    [
      "stm_device_touch",
      "stm_duration_ms",
      "stm_max_length_reached",
      "stm_participant_id",
      "stm_practice_json",
      "stm_span",
      "stm_summary_json",
      "stm_total_correct",
      "stm_trials_completed",
      "stm_trials_json",
    ]
  );
  expect(ed.stm_span).toBe("0");
  expect(ed.stm_trials_completed).toBe("2");
  expect(JSON.parse(ed.stm_trials_json)).toHaveLength(2);
  expect(JSON.parse(ed.stm_summary_json).discontinued).toBe(1);
  await expect(page.locator("#display_stage")).toHaveCount(0);
});

test("Digit_Span.qsf is import-ready and points at the hosted assets", () => {
  const qsf = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../qualtrics-v7/Digit_Span.qsf"), "utf8")
  );
  const questions = qsf.SurveyElements.filter((e) => e.Element === "SQ");
  const taskQuestion = questions.find((e) => e.PrimaryAttribute === "QID2");
  const flow = qsf.SurveyElements.find((e) => e.Element === "FL").Payload.Flow;
  const embeddedData = flow.find((item) => item.Type === "EmbeddedData").EmbeddedData;

  expect(qsf.SurveyEntry.SurveyName).toBe("Digit Span");
  expect(questions).toHaveLength(3);
  expect(flow.map((item) => item.Type)).toEqual(["Block", "EmbeddedData", "Standard", "Standard"]);
  expect(embeddedData.map((f) => f.Field)).toHaveLength(10);
  expect(embeddedData.every((f) => f.Field.startsWith("stm_"))).toBe(true);
  expect(taskQuestion.Payload.QuestionJS).toContain('"https://wrayo.github.io/stm-jspsych"');
  expect(taskQuestion.Payload.QuestionJS).toContain('assetBaseUrl + "/stm-v7-task.js"');
  expect(taskQuestion.Payload.QuestionText).toContain("stm-load-status");
  expect(JSON.stringify(qsf)).not.toMatch(/animals/i);
});
