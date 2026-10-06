# stm-jspsych

Two short-term memory tasks for PSC 1 (UC Davis), built with jsPsych 7.3.1 and embedded in Qualtrics: a forward digit span task and a number grid task modeled on the humanbenchmark.com chimp test. Same pattern as `jspsych-squaredtasks` and `semantic-jspsych`: the task is hosted on GitHub Pages and loaded into a Qualtrics question by the question's JavaScript, which writes the results back as Embedded Data.

- Live previews: https://wrayo.github.io/stm-jspsych/qualtrics-v7/preview.html (digit span) and https://wrayo.github.io/stm-jspsych/qualtrics-v7/chimp-preview.html (number grid)
- Qualtrics imports: `qualtrics-v7/Digit_Span.qsf` and `qualtrics-v7/Chimp_Task.qsf`
- Setup and field lists: `qualtrics-v7/QUALTRICS_SETUP.md`

## Digit span

One practice list of 3 digits, then lists of 3 to 10 digits, two lists per length. Digits appear one at a time (800 ms on, 200 ms blank). Students recall with an on-screen keypad, so it works on phones; laptop users can also type digits, Backspace and Enter. The task stops when both lists at a length are wrong. Span is the longest length recalled perfectly at least once. Worst case is about 5 minutes.

## Number grid (chimp style)

Numbers 1 to N appear in random boxes on a 40-cell grid (8 x 5 on laptops, 5 x 8 on phones held upright). The numbers stay up until the student taps 1; then the rest are hidden and the student taps the boxes in order. A wrong tap ends the round and briefly shows where the numbers were. One practice round of 3, then rounds of 4 to 12, two per length, with the same stopping rule and span definition as digit span. Worst case is about 3 to 4 minutes. Setting `exposureMs` hides the numbers on a timer instead, closer to the Inoue and Matsuzawa (2007) chimpanzee procedure.

## Files

Each task has the same set of files, prefixed `stm-` (digit span) or `chimp-` (number grid):

- `qualtrics-v7/stm-v7-task.js`, `chimp-v7-task.js`: the task (custom plugin, timeline, scoring). Reads `window.stmTaskConfig` or `window.chimpTaskConfig` and calls the matching `onFinish(jsPsych, payload)` hook.
- `qualtrics-v7/stm-qualtrics.js`, `chimp-qualtrics.js`: Qualtrics question JavaScript.
- `qualtrics-v7/*-intro.html`, `*-question.html`, `*-end.html`: Qualtrics question text.
- `qualtrics-v7/preview.html`, `chimp-preview.html`: standalone previews.
- `qualtrics-v7/generate-qsf.js`: builds both QSF files from `templates/base.qsf`.
- `qualtrics-v7/lib/jspsych-7.3.1/`: vendored jsPsych core and the two plugins used.

## Development

```
npm install
npm run build:qsf
npm test
```

Preview with fast timings and a fixed seed: `qualtrics-v7/preview.html?digitMs=50&blankMs=10&readyMs=50&feedbackMs=50&seed=abc` or `qualtrics-v7/chimp-preview.html?readyMs=50&feedbackMs=50&revealMs=50&seed=abc`

Pushing to `main` deploys the whole repo to GitHub Pages (`.github/workflows/deploy-pages.yml`).
