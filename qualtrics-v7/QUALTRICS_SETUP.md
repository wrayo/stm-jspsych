# Qualtrics Setup: Digit Span

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

After editing `stm-qualtrics.js` in the repo, run `npm run build:qsf` to rebuild `Digit_Span.qsf`.

## Troubleshooting

- "The digit memory task is loading" never goes away: the GitHub Pages site is down or the URL in `siteBaseUrl` is wrong. Open `https://wrayo.github.io/stm-jspsych/qualtrics-v7/stm-v7-task.js` in a browser to check.
- The task does not run in the Qualtrics mobile preview pane. This is on purpose. Use the anonymous link.
