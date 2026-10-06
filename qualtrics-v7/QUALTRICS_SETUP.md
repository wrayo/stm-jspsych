# Qualtrics Setup: Digit Span and Number Grid

The two tasks are separate surveys with the same structure. Digit span files and fields use `stm`; the number grid (chimp-style) task uses `chimp`. The steps below are written for digit span; for the number grid task swap in `Chimp_Task.qsf`, `chimp-question.html`, `chimp-qualtrics.js`, and the `chimp_` fields listed at the end.

## Fast path: import the survey

1. In Qualtrics, Create project > Survey > From a file, and choose `Digit_Span.qsf`.
2. Publish the survey.
3. Open the anonymous link (not the editor preview) on a phone and on a laptop and run the task once on each.
4. In Data & Analysis, confirm the 10 `stm_` columns below have values.

The survey has three pages: Welcome, the task, and a Completion page. The Back button is off.

## Adding the task to another survey

1. Survey Flow: add an Embedded Data element **before** the task block with the 10 field names below. A field that is not declared there is silently dropped.
2. Put the task in its own block, as a single Text/Graphic question, on its own page.
3. Question HTML view: paste `stm-question.html`.
4. Question JavaScript: replace everything with `stm-qualtrics.js`.

## Embedded Data fields

| Field | Contents |
|---|---|
| `stm_participant_id` | Qualtrics ResponseID |
| `stm_span` | Longest list length recalled perfectly (0 if none) |
| `stm_total_correct` | Number of fully correct main lists |
| `stm_trials_completed` | Main lists attempted |
| `stm_max_length_reached` | Longest list length shown |
| `stm_duration_ms` | Total task time |
| `stm_device_touch` | 1 if the device has a touch screen, else 0 |
| `stm_summary_json` | Span, totals, correct per length, and the settings used |
| `stm_practice_json` | The practice list row |
| `stm_trials_json` | One row per main list: `length`, `trial_in_length`, `sequence`, `response`, `correct`, `positions_correct`, `rt_ms`, `edits` |

## Changing settings

Edit `taskConfig` at the top of `stm-qualtrics.js` (or the Question JavaScript in Qualtrics):

- `digitMs` / `blankMs`: how long each digit is on and the gap after it (default 800 / 200, so 1 digit per second)
- `readyMs`: the "Get ready" screen (default 1000)
- `minLength` / `maxLength`: list lengths (default 3 to 10)
- `trialsPerLength`: lists at each length (default 2). The task stops when every list at a length is wrong.
- `showFeedback`: brief "Correct" / "Not quite" after each list (default true)

After editing `stm-qualtrics.js` or `chimp-qualtrics.js` in the repo, run `npm run build:qsf` to rebuild both QSF files.

## Troubleshooting

- "The digit memory task is loading" never goes away: the GitHub Pages site is down or the URL in `siteBaseUrl` is wrong. Open `https://wrayo.github.io/stm-jspsych/qualtrics-v7/stm-v7-task.js` in a browser to check.
- The task does not run in the Qualtrics mobile preview pane. This is on purpose. Use the anonymous link.

## Number grid task

### Embedded Data fields

The same 10 fields as digit span, with the `chimp_` prefix: `chimp_participant_id`, `chimp_span`, `chimp_total_correct`, `chimp_trials_completed`, `chimp_max_length_reached`, `chimp_duration_ms`, `chimp_device_touch`, `chimp_summary_json`, `chimp_practice_json`, `chimp_trials_json`.

`chimp_span` is the most numbers tapped in the right order at least once (0 if none). Each row of `chimp_trials_json` has:

| Key | Contents |
|---|---|
| `length`, `trial_in_length` | Round size and which of the two rounds at that size |
| `layout` | Cell of each number, in order (cells 0 to 39, row * 8 + column on the 8 x 5 grid) |
| `taps` | Cells the student tapped, in order |
| `correct` | 1 if every number was tapped in order |
| `n_correct_before_error` | Numbers tapped correctly before the first wrong tap |
| `study_ms` | Time from the grid appearing to the first tap |
| `rt_ms` | Time from the grid appearing to the end of the round |
| `grid` | `8x5` (wide screen) or `5x8` (phone held upright) |
| `hidden_by` | `tap` or `timer`: what hid the numbers |

### Changing settings

Edit `taskConfig` at the top of `chimp-qualtrics.js`:

- `minLength` / `maxLength`: numbers per round (default 4 to 12)
- `trialsPerLength`: rounds at each size (default 2). The task stops when every round at a size is wrong.
- `exposureMs`: 0 (default) keeps the numbers up until the first tap. A value such as 1000 hides them after that many milliseconds.
- `revealMs`: how long the numbers are shown again after a wrong tap (default 1000)
- `readyMs`, `feedbackMs`, `showFeedback`: same as digit span
