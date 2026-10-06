# stm-jspsych

Forward digit span task for PSC 1 (UC Davis), built with jsPsych 7.3.1 and embedded in Qualtrics. Same pattern as `jspsych-squaredtasks` and `semantic-jspsych`: the task is hosted on GitHub Pages and loaded into a Qualtrics question by the question's JavaScript, which writes the results back as Embedded Data.

- Live preview: https://wrayo.github.io/stm-jspsych/qualtrics-v7/preview.html
- Qualtrics import: `qualtrics-v7/Digit_Span.qsf`
- Setup and field list: `qualtrics-v7/QUALTRICS_SETUP.md`

## The task

One practice list of 3 digits, then lists of 3 to 10 digits, two lists per length. Digits appear one at a time (800 ms on, 200 ms blank). Students recall with an on-screen keypad, so it works on phones; laptop users can also type digits, Backspace and Enter. The task stops when both lists at a length are wrong. Span is the longest length recalled perfectly at least once. Worst case is about 5 minutes.

## Files

- `qualtrics-v7/stm-v7-task.js`: the task (keypad plugin, timeline, scoring). Reads `window.stmTaskConfig` and calls `window.stmTaskHooks.onFinish(jsPsych, payload)`.
- `qualtrics-v7/stm-qualtrics.js`: Qualtrics question JavaScript.
- `qualtrics-v7/stm-intro.html`, `stm-question.html`, `stm-end.html`: Qualtrics question text.
- `qualtrics-v7/generate-stm-qsf.js`: builds `Digit_Span.qsf` from `templates/base.qsf`.
- `qualtrics-v7/lib/jspsych-7.3.1/`: vendored jsPsych core and the two plugins used.

## Development

```
npm install
npm run build:qsf
npm test
```

Preview with fast timings and a fixed seed: `qualtrics-v7/preview.html?digitMs=50&blankMs=10&readyMs=50&feedbackMs=50&seed=abc`

Pushing to `main` deploys the whole repo to GitHub Pages (`.github/workflows/deploy-pages.yml`).
