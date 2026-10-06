/////////////////////////////////////////////////////
// NUMBER GRID MEMORY, CHIMP STYLE (jsPsych 7.3.1) //
/////////////////////////////////////////////////////

/*
Visuospatial short-term memory demo for PSC 1, modeled on the humanbenchmark.com chimp test.

Procedure:
- Numbers 1 to N appear in random cells of a 40-cell grid (8 x 5 on wide screens, 5 x 8 on tall phone screens).
- The numbers stay up until the first tap. Tapping 1 hides the rest behind blank tiles (exposureMs > 0 also hides them on a timer).
- The student taps the tiles in order. A wrong tap ends the round and briefly reveals the numbers.
- One practice round of 3, then main rounds from minLength to maxLength (default 4 to 12), trialsPerLength rounds at each length (default 2).
- The task stops when every round at a length is wrong (same rule as the digit span task).

Scoring:
- span: longest length with at least one fully correct round (0 if none).
- total_correct: number of fully correct main rounds.
- n_correct_before_error (per round): tiles tapped in the right order before the first error.

Layouts are stored as cell indices in the 8 x 5 (landscape) grid, row * 8 + col. Tall screens show the transposed grid,
so a fixed seed gives the same layout on any device.

Config is read from window.chimpTaskConfig. When window.chimpTaskHooks.onFinish exists it receives (jsPsych, payload);
the Qualtrics wrapper uses that hook to write Embedded Data. Without a hook the task still runs (chimp-preview.html).
*/

var chimpTaskConfig = window.chimpTaskConfig || {};
var chimpTaskHooks = window.chimpTaskHooks || {};

var CHIMP_TASK_VERSION = "number_grid_chimp_v7_1.0";
var CHIMP_ROWS = 5;
var CHIMP_COLS = 8;

function chimpNumberSetting(name, fallback) {
  var value = chimpTaskConfig[name];
  return typeof value === "number" && isFinite(value) ? value : fallback;
}

var chimpSettings = {
  readyMs: chimpNumberSetting("readyMs", 1000),
  feedbackMs: chimpNumberSetting("feedbackMs", 800),
  revealMs: chimpNumberSetting("revealMs", 1000),
  exposureMs: chimpNumberSetting("exposureMs", 0),
  minLength: chimpNumberSetting("minLength", 4),
  maxLength: chimpNumberSetting("maxLength", 12),
  trialsPerLength: chimpNumberSetting("trialsPerLength", 2),
  practiceLength: chimpNumberSetting("practiceLength", 3),
  showFeedback: chimpTaskConfig.showFeedback !== false,
  seed: chimpTaskConfig.seed === undefined || chimpTaskConfig.seed === null ? null : String(chimpTaskConfig.seed)
};

var chimpParticipantId = chimpTaskConfig.participantId || "";
var chimpFinishButtonLabel = chimpTaskConfig.finishButtonLabel || "Continue";
var chimpDeviceTouch = ("ontouchstart" in window) || (navigator.maxTouchPoints || 0) > 0 ? 1 : 0;

function chimpResolveDisplayElement(displayElement) {
  if (!displayElement) {
    return undefined;
  }
  if (typeof displayElement === "string") {
    return document.getElementById(displayElement) || displayElement;
  }
  return displayElement;
}

////////////////////////
// RANDOM LAYOUTS     //
////////////////////////

// mulberry32 seeded from a string hash, so a fixed seed gives the same layouts (testing only)
function chimpMakeRng(seed) {
  if (seed === null) {
    return Math.random;
  }
  var h = 1779033703 ^ seed.length;
  for (var i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  var state = h >>> 0;
  return function () {
    state = (state + 0x6D2B79F5) >>> 0;
    var t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

var chimpRng = chimpMakeRng(chimpSettings.seed);

// N distinct cells; layout[i] is the cell that holds the number i + 1
function chimpMakeLayout(length) {
  var cells = [];
  for (var c = 0; c < CHIMP_ROWS * CHIMP_COLS; c++) {
    cells.push(c);
  }
  for (var i = 0; i < length; i++) {
    var j = i + Math.floor(chimpRng() * (cells.length - i));
    var tmp = cells[i];
    cells[i] = cells[j];
    cells[j] = tmp;
  }
  return cells.slice(0, length);
}

var chimpPracticeLayout = chimpMakeLayout(chimpSettings.practiceLength);
var chimpMainLayouts = {};
for (var chimpLen = chimpSettings.minLength; chimpLen <= chimpSettings.maxLength; chimpLen++) {
  chimpMainLayouts[chimpLen] = [];
  for (var chimpRep = 0; chimpRep < chimpSettings.trialsPerLength; chimpRep++) {
    chimpMainLayouts[chimpLen].push(chimpMakeLayout(chimpLen));
  }
}

if (chimpTaskConfig.exposeSequences === true) {
  window.chimpTaskDebug = { practice: chimpPracticeLayout, main: chimpMainLayouts };
}

////////////////////////
// GRID PLUGIN        //
////////////////////////

var jsPsychNumberGrid = (function (jspsych) {
  "use strict";

  var info = {
    name: "number-grid",
    parameters: {
      layout: { type: jspsych.ParameterType.INT, array: true, default: [] },
      prompt: { type: jspsych.ParameterType.HTML_STRING, default: "" },
      exposure_ms: { type: jspsych.ParameterType.INT, default: 0 },
      reveal_ms: { type: jspsych.ParameterType.INT, default: 1000 }
    }
  };

  class NumberGridPlugin {
    constructor(jsPsych) {
      this.jsPsych = jsPsych;
    }

    trial(display_element, trial) {
      var jsPsychRef = this.jsPsych;
      var stage = jsPsychRef.getDisplayElement();
      var stageWidth = stage.clientWidth || window.innerWidth;
      var stageHeight = stage.clientHeight || window.innerHeight;
      var portrait = stageHeight > stageWidth;
      var rows = portrait ? CHIMP_COLS : CHIMP_ROWS;
      var cols = portrait ? CHIMP_ROWS : CHIMP_COLS;

      // the prompt takes about 48px; leave a gutter so tiles never touch the stage edge
      var cell = Math.floor(Math.min((stageWidth - 24) / cols, (stageHeight - 96) / rows, 110));
      var tileSize = Math.round(cell * 0.84);
      var inset = Math.round((cell - tileSize) / 2);

      var numberAtCell = {};
      trial.layout.forEach(function (cellIndex, i) {
        numberAtCell[cellIndex] = i + 1;
      });

      var tilesHtml = trial.layout.map(function (cellIndex, i) {
        var r = Math.floor(cellIndex / CHIMP_COLS);
        var c = cellIndex % CHIMP_COLS;
        var displayRow = portrait ? c : r;
        var displayCol = portrait ? r : c;
        return "<button type='button' class='chimp-tile' data-cell='" + cellIndex + "' style='" +
          "left:" + (displayCol * cell + inset) + "px;top:" + (displayRow * cell + inset) + "px;" +
          "width:" + tileSize + "px;height:" + tileSize + "px;font-size:" + Math.round(tileSize * 0.5) + "px'>" +
          "<span class='chimp-tile-number'>" + (i + 1) + "</span></button>";
      }).join("");

      display_element.innerHTML =
        "<div class='chimp-trial'>" +
        "<div class='chimp-prompt'>" + trial.prompt + "</div>" +
        "<div class='chimp-grid' id='chimp-grid' data-grid='" + cols + "x" + rows + "' style='width:" + (cols * cell) + "px;height:" + (rows * cell) + "px'>" +
        tilesHtml +
        "</div></div>";

      var gridNode = display_element.querySelector("#chimp-grid");
      var startTime = performance.now();
      var firstTapTime = null;
      var nextNumber = 1;
      var taps = [];
      var hidden = false;
      var hiddenBy = "";
      var finished = false;

      function hideNumbers(reason) {
        if (hidden) {
          return;
        }
        hidden = true;
        hiddenBy = reason;
        gridNode.classList.add("chimp-hidden");
      }

      function finish(correct) {
        finished = true;
        gridNode.removeEventListener("pointerdown", onPointerDown);
        var now = performance.now();
        var data = {
          layout: trial.layout.slice(),
          taps: taps.slice(),
          correct: correct ? 1 : 0,
          n_correct_before_error: nextNumber - 1,
          study_ms: firstTapTime === null ? null : Math.round(firstTapTime - startTime),
          rt: Math.round(now - startTime),
          grid: cols + "x" + rows,
          hidden_by: hiddenBy
        };

        if (correct || trial.reveal_ms <= 0) {
          display_element.innerHTML = "";
          jsPsychRef.finishTrial(data);
          return;
        }

        // show where the numbers were, with the wrong tap marked
        gridNode.classList.remove("chimp-hidden");
        gridNode.classList.add("chimp-reveal");
        jsPsychRef.pluginAPI.setTimeout(function () {
          display_element.innerHTML = "";
          jsPsychRef.finishTrial(data);
        }, trial.reveal_ms);
      }

      function onPointerDown(event) {
        var tile = event.target.closest(".chimp-tile");
        if (finished || !tile || tile.classList.contains("chimp-tile-done")) {
          return;
        }
        event.preventDefault();

        var cellIndex = Number(tile.getAttribute("data-cell"));
        if (firstTapTime === null) {
          firstTapTime = performance.now();
        }
        taps.push(cellIndex);

        if (numberAtCell[cellIndex] !== nextNumber) {
          tile.classList.add("chimp-tile-wrong");
          finish(false);
          return;
        }

        tile.classList.add("chimp-tile-done");
        nextNumber += 1;
        hideNumbers("tap");
        if (nextNumber > trial.layout.length) {
          finish(true);
        }
      }

      gridNode.addEventListener("pointerdown", onPointerDown);

      if (trial.exposure_ms > 0) {
        jsPsychRef.pluginAPI.setTimeout(function () {
          if (!finished) {
            hideNumbers("timer");
          }
        }, trial.exposure_ms);
      }
    }
  }

  NumberGridPlugin.info = info;
  return NumberGridPlugin;
})(jsPsychModule);

////////////////////////
// STATE AND SCORING  //
////////////////////////

var chimpPracticeRows = [];
var chimpMainRows = [];
var chimpStopped = false;

function chimpComputeSummary() {
  var byLength = {};
  var span = 0;
  var totalCorrect = 0;
  var maxLengthReached = 0;

  chimpMainRows.forEach(function (row) {
    var key = String(row.length);
    if (!byLength[key]) {
      byLength[key] = { attempted: 0, correct: 0 };
    }
    byLength[key].attempted += 1;
    byLength[key].correct += row.correct;
    totalCorrect += row.correct;
    if (row.correct === 1 && row.length > span) {
      span = row.length;
    }
    if (row.length > maxLengthReached) {
      maxLengthReached = row.length;
    }
  });

  return {
    span: span,
    total_correct: totalCorrect,
    trials_completed: chimpMainRows.length,
    max_length_reached: maxLengthReached,
    discontinued: chimpStopped ? 1 : 0,
    by_length: byLength
  };
}

function chimpBuildExperimentPayload() {
  var summary = chimpComputeSummary();
  return {
    task_version: CHIMP_TASK_VERSION,
    participant_id: chimpParticipantId,
    span: summary.span,
    total_correct: summary.total_correct,
    trials_completed: summary.trials_completed,
    max_length_reached: summary.max_length_reached,
    duration_ms: Math.round(jsPsych.getTotalTime()),
    device_touch: chimpDeviceTouch,
    summary: {
      task_version: CHIMP_TASK_VERSION,
      span: summary.span,
      total_correct: summary.total_correct,
      trials_completed: summary.trials_completed,
      max_length_reached: summary.max_length_reached,
      discontinued: summary.discontinued,
      by_length: summary.by_length,
      settings: chimpSettings
    },
    practice: chimpPracticeRows,
    trials: chimpMainRows
  };
}

////////////////////////
// jsPsych INIT       //
////////////////////////

var jsPsych = initJsPsych({
  display_element: chimpResolveDisplayElement(chimpTaskConfig.displayElement),
  on_finish: function () {
    var payload = chimpBuildExperimentPayload();
    window.chimpTaskLastRun = payload;
    if (typeof chimpTaskHooks.onFinish === "function") {
      chimpTaskHooks.onFinish(jsPsych, payload);
    }
  }
});

////////////////////////
// TIMELINE BUILDERS  //
////////////////////////

function chimpReadyScreen(label) {
  return {
    type: jsPsychHtmlKeyboardResponse,
    stimulus:
      "<div class='chimp-ready'><p class='chimp-ready-label'>" + label + "</p>" +
      "<p class='chimp-ready-text'>Get ready</p></div>",
    choices: "NO_KEYS",
    trial_duration: chimpSettings.readyMs,
    data: { task: "chimp_ready" }
  };
}

function chimpGridScreen(layout, phase, length, trialInLength) {
  return {
    type: jsPsychNumberGrid,
    layout: layout,
    prompt: "Tap the numbers in order, starting with 1.",
    exposure_ms: chimpSettings.exposureMs,
    reveal_ms: chimpSettings.revealMs,
    data: { task: "chimp_grid", phase: phase },
    on_finish: function (data) {
      var row = {
        length: length,
        trial_in_length: trialInLength,
        layout: data.layout,
        taps: data.taps,
        correct: data.correct,
        n_correct_before_error: data.n_correct_before_error,
        study_ms: data.study_ms,
        rt_ms: data.rt,
        grid: data.grid,
        hidden_by: data.hidden_by
      };

      if (phase === "practice") {
        chimpPracticeRows.push(row);
        return;
      }

      chimpMainRows.push(row);
      if (trialInLength === chimpSettings.trialsPerLength) {
        var anyCorrect = chimpMainRows.some(function (r) {
          return r.length === length && r.correct === 1;
        });
        if (!anyCorrect) {
          chimpStopped = true;
        }
      }
    }
  };
}

function chimpPracticeFeedback() {
  return {
    type: jsPsychHtmlButtonResponse,
    stimulus: function () {
      var last = chimpPracticeRows[chimpPracticeRows.length - 1];
      if (last && last.correct === 1) {
        return "<div class='chimp-text'><p class='chimp-feedback chimp-feedback-correct'>Correct!</p>" +
          "<p>In the real task the rounds start at " + chimpSettings.minLength + " numbers and get longer. Do your best on each one.</p></div>";
      }
      return "<div class='chimp-text'><p class='chimp-feedback chimp-feedback-wrong'>Not quite.</p>" +
        "<p>Tap the boxes in number order: 1 first, then 2, then 3. In the real task the rounds start at " +
        chimpSettings.minLength + " numbers and get longer.</p></div>";
    },
    choices: ["Begin the task"],
    data: { task: "chimp_practice_feedback" }
  };
}

function chimpMainFeedback() {
  return {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: function () {
      var last = chimpMainRows[chimpMainRows.length - 1];
      if (last && last.correct === 1) {
        return "<p class='chimp-feedback chimp-feedback-correct'>Correct</p>";
      }
      return "<p class='chimp-feedback chimp-feedback-wrong'>Not quite</p>";
    },
    choices: "NO_KEYS",
    trial_duration: chimpSettings.feedbackMs,
    data: { task: "chimp_feedback" }
  };
}

////////////////////////
// TIMELINE           //
////////////////////////

var chimpHideText = chimpSettings.exposureMs > 0
  ? "<p>The numbers disappear after a moment, or as soon as you tap 1. Then tap the hidden boxes in order.</p>"
  : "<p>As soon as you tap 1, the other numbers are hidden. Take as long as you like to study them before you start.</p>";

var chimpTimeline = [];

chimpTimeline.push({
  type: jsPsychHtmlButtonResponse,
  stimulus:
    "<div class='chimp-text'>" +
    "<h2>Number Grid Memory</h2>" +
    "<p>Numbers will appear in boxes scattered across the screen.</p>" +
    "<p>Tap the boxes <strong>in number order</strong>, starting with 1.</p>" +
    chimpHideText +
    "<p>A wrong tap ends that round. Please do not write anything down.</p>" +
    "<p>First, a short practice round.</p>" +
    "</div>",
  choices: ["Start practice"],
  data: { task: "chimp_instructions" }
});

chimpTimeline.push(chimpReadyScreen("Practice"));
chimpTimeline.push(chimpGridScreen(chimpPracticeLayout, "practice", chimpSettings.practiceLength, 1));
chimpTimeline.push(chimpPracticeFeedback());

var chimpRoundNumber = 0;
for (var chimpL = chimpSettings.minLength; chimpL <= chimpSettings.maxLength; chimpL++) {
  for (var chimpT = 1; chimpT <= chimpSettings.trialsPerLength; chimpT++) {
    chimpRoundNumber += 1;
    var chimpTrialNodes = [
      chimpReadyScreen("Round " + chimpRoundNumber),
      chimpGridScreen(chimpMainLayouts[chimpL][chimpT - 1], "main", chimpL, chimpT)
    ];
    if (chimpSettings.showFeedback) {
      chimpTrialNodes.push(chimpMainFeedback());
    }
    chimpTimeline.push({
      timeline: chimpTrialNodes,
      conditional_function: function () {
        return !chimpStopped;
      }
    });
  }
}

chimpTimeline.push({
  type: jsPsychHtmlButtonResponse,
  stimulus: function () {
    var summary = chimpComputeSummary();
    return "<div class='chimp-text'>" +
      "<h2>All done</h2>" +
      "<p>Your grid span today:</p>" +
      "<p class='chimp-span-score' id='chimp-span-score'>" + summary.span + "</p>" +
      "<p>This is the most numbers you tapped in the right order at least once.</p>" +
      "<p>We will look at the class results together.</p>" +
      "</div>";
  },
  choices: [chimpFinishButtonLabel],
  data: { task: "chimp_end" }
});

jsPsych.run(chimpTimeline);
