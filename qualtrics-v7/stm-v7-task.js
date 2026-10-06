/////////////////////////////////////
// FORWARD DIGIT SPAN (jsPsych 7.3.1) //
/////////////////////////////////////

/*
Short-term memory demo for PSC 1.

Procedure:
- One practice list of 3 digits, with feedback that shows the correct answer.
- Main lists run from minLength to maxLength digits (default 3 to 10), trialsPerLength lists at each length (default 2).
- Each list: "Get ready" screen, then digits one at a time (digitMs on, blankMs blank), then an on-screen keypad for recall.
- The task stops when every list at a length is recalled incorrectly.

Scoring:
- span: longest length with at least one fully correct list (0 if none).
- total_correct: number of fully correct main lists.
- positions_correct (per list): digits recalled in the correct serial position.

Config is read from window.stmTaskConfig. When window.stmTaskHooks.onFinish exists it receives (jsPsych, payload);
the Qualtrics wrapper uses that hook to write Embedded Data. Without a hook the task still runs (preview.html).
*/

var stmTaskConfig = window.stmTaskConfig || {};
var stmTaskHooks = window.stmTaskHooks || {};

var STM_TASK_VERSION = "digit_span_forward_v7_1.0";

function stmNumberSetting(name, fallback) {
  var value = stmTaskConfig[name];
  return typeof value === "number" && isFinite(value) ? value : fallback;
}

var stmSettings = {
  digitMs: stmNumberSetting("digitMs", 800),
  blankMs: stmNumberSetting("blankMs", 200),
  readyMs: stmNumberSetting("readyMs", 1000),
  feedbackMs: stmNumberSetting("feedbackMs", 800),
  minLength: stmNumberSetting("minLength", 3),
  maxLength: stmNumberSetting("maxLength", 10),
  trialsPerLength: stmNumberSetting("trialsPerLength", 2),
  practiceLength: stmNumberSetting("practiceLength", 3),
  showFeedback: stmTaskConfig.showFeedback !== false,
  seed: stmTaskConfig.seed === undefined || stmTaskConfig.seed === null ? null : String(stmTaskConfig.seed)
};

var stmParticipantId = stmTaskConfig.participantId || "";
var stmFinishButtonLabel = stmTaskConfig.finishButtonLabel || "Continue";
var stmDeviceTouch = ("ontouchstart" in window) || (navigator.maxTouchPoints || 0) > 0 ? 1 : 0;

function stmResolveDisplayElement(displayElement) {
  if (!displayElement) {
    return undefined;
  }
  if (typeof displayElement === "string") {
    return document.getElementById(displayElement) || displayElement;
  }
  return displayElement;
}

////////////////////////
// RANDOM SEQUENCES   //
////////////////////////

// mulberry32 seeded from a string hash, so a fixed seed gives the same lists (testing only)
function stmMakeRng(seed) {
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

var stmRng = stmMakeRng(stmSettings.seed);

// random digits 0-9 with no digit repeated back to back
function stmMakeSequence(length) {
  var digits = [];
  while (digits.length < length) {
    var next = Math.floor(stmRng() * 10);
    if (digits.length === 0 || digits[digits.length - 1] !== next) {
      digits.push(next);
    }
  }
  return digits.join("");
}

var stmPracticeSequence = stmMakeSequence(stmSettings.practiceLength);
var stmMainSequences = {};
for (var stmLen = stmSettings.minLength; stmLen <= stmSettings.maxLength; stmLen++) {
  stmMainSequences[stmLen] = [];
  for (var stmRep = 0; stmRep < stmSettings.trialsPerLength; stmRep++) {
    stmMainSequences[stmLen].push(stmMakeSequence(stmLen));
  }
}

if (stmTaskConfig.exposeSequences === true) {
  window.stmTaskDebug = { practice: stmPracticeSequence, main: stmMainSequences };
}

////////////////////////
// KEYPAD PLUGIN      //
////////////////////////

var jsPsychDigitKeypad = (function (jspsych) {
  "use strict";

  var info = {
    name: "digit-keypad",
    parameters: {
      prompt: { type: jspsych.ParameterType.HTML_STRING, default: "" },
      max_digits: { type: jspsych.ParameterType.INT, default: 12 },
      done_label: { type: jspsych.ParameterType.STRING, default: "Done" }
    }
  };

  class DigitKeypadPlugin {
    constructor(jsPsych) {
      this.jsPsych = jsPsych;
    }

    trial(display_element, trial) {
      var jsPsychRef = this.jsPsych;
      var entry = "";
      var edits = 0;
      var startTime = performance.now();
      var finished = false;

      var keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "del", "0", "done"];
      var keyHtml = keys.map(function (key) {
        if (key === "del") {
          return "<button type='button' class='stm-key stm-key-del' data-key='del' aria-label='Delete last digit'>Delete</button>";
        }
        if (key === "done") {
          return "<button type='button' class='stm-key stm-key-done' data-key='done' disabled>" + trial.done_label + "</button>";
        }
        return "<button type='button' class='stm-key' data-key='" + key + "'>" + key + "</button>";
      }).join("");

      display_element.innerHTML =
        "<div class='stm-keypad-wrap'>" +
        "<div class='stm-prompt'>" + trial.prompt + "</div>" +
        "<div class='stm-entry' id='stm-entry' aria-live='polite'><span class='stm-entry-placeholder'>Tap the digits in order</span></div>" +
        "<div class='stm-keypad'>" + keyHtml + "</div>" +
        "</div>";

      var entryNode = display_element.querySelector("#stm-entry");
      var doneButton = display_element.querySelector(".stm-key-done");

      function render() {
        if (entry.length === 0) {
          entryNode.innerHTML = "<span class='stm-entry-placeholder'>Tap the digits in order</span>";
        } else {
          entryNode.textContent = entry.split("").join(" ");
        }
        doneButton.disabled = entry.length === 0;
      }

      function press(key) {
        if (finished) {
          return;
        }
        if (key === "del") {
          if (entry.length > 0) {
            entry = entry.slice(0, -1);
            edits += 1;
          }
        } else if (key === "done") {
          if (entry.length > 0) {
            finish();
            return;
          }
        } else if (/^[0-9]$/.test(key) && entry.length < trial.max_digits) {
          entry += key;
        }
        render();
      }

      function onClick(event) {
        var button = event.target.closest(".stm-key");
        if (button && !button.disabled) {
          press(button.getAttribute("data-key"));
        }
      }

      function onKeyDown(event) {
        var key = event.key;
        if (/^[0-9]$/.test(key)) {
          event.preventDefault();
          press(key);
        } else if (key === "Backspace" || key === "Delete") {
          event.preventDefault();
          press("del");
        } else if (key === "Enter") {
          event.preventDefault();
          press("done");
        }
      }

      function finish() {
        finished = true;
        display_element.removeEventListener("click", onClick);
        document.removeEventListener("keydown", onKeyDown);
        var rt = Math.round(performance.now() - startTime);
        display_element.innerHTML = "";
        jsPsychRef.finishTrial({ response: entry, rt: rt, edits: edits });
      }

      display_element.addEventListener("click", onClick);
      document.addEventListener("keydown", onKeyDown);
    }
  }

  DigitKeypadPlugin.info = info;
  return DigitKeypadPlugin;
})(jsPsychModule);

////////////////////////
// STATE AND SCORING  //
////////////////////////

var stmPracticeRows = [];
var stmMainRows = [];
var stmStopped = false;

function stmScoreResponse(sequence, response) {
  var positionsCorrect = 0;
  for (var i = 0; i < sequence.length; i++) {
    if (response.charAt(i) === sequence.charAt(i)) {
      positionsCorrect += 1;
    }
  }
  return {
    correct: response === sequence ? 1 : 0,
    positions_correct: positionsCorrect
  };
}

function stmComputeSummary() {
  var byLength = {};
  var span = 0;
  var totalCorrect = 0;
  var maxLengthReached = 0;

  stmMainRows.forEach(function (row) {
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
    trials_completed: stmMainRows.length,
    max_length_reached: maxLengthReached,
    discontinued: stmStopped ? 1 : 0,
    by_length: byLength
  };
}

function stmBuildExperimentPayload() {
  var summary = stmComputeSummary();
  return {
    task_version: STM_TASK_VERSION,
    participant_id: stmParticipantId,
    span: summary.span,
    total_correct: summary.total_correct,
    trials_completed: summary.trials_completed,
    max_length_reached: summary.max_length_reached,
    duration_ms: Math.round(jsPsych.getTotalTime()),
    device_touch: stmDeviceTouch,
    summary: {
      task_version: STM_TASK_VERSION,
      span: summary.span,
      total_correct: summary.total_correct,
      trials_completed: summary.trials_completed,
      max_length_reached: summary.max_length_reached,
      discontinued: summary.discontinued,
      by_length: summary.by_length,
      settings: stmSettings
    },
    practice: stmPracticeRows,
    trials: stmMainRows
  };
}

////////////////////////
// jsPsych INIT       //
////////////////////////

var jsPsych = initJsPsych({
  display_element: stmResolveDisplayElement(stmTaskConfig.displayElement),
  on_finish: function () {
    var payload = stmBuildExperimentPayload();
    window.stmTaskLastRun = payload;
    if (typeof stmTaskHooks.onFinish === "function") {
      stmTaskHooks.onFinish(jsPsych, payload);
    }
  }
});

////////////////////////
// TIMELINE BUILDERS  //
////////////////////////

function stmReadyScreen(label) {
  return {
    type: jsPsychHtmlKeyboardResponse,
    stimulus:
      "<div class='stm-ready'><p class='stm-ready-label'>" + label + "</p>" +
      "<p class='stm-ready-text'>Get ready</p></div>",
    choices: "NO_KEYS",
    trial_duration: stmSettings.readyMs,
    data: { task: "stm_ready" }
  };
}

function stmDigitScreens(sequence) {
  var screens = [];
  sequence.split("").forEach(function (digit) {
    screens.push({
      type: jsPsychHtmlKeyboardResponse,
      stimulus: "<div class='stm-digit'>" + digit + "</div>",
      choices: "NO_KEYS",
      trial_duration: stmSettings.digitMs,
      data: { task: "stm_digit" }
    });
    if (stmSettings.blankMs > 0) {
      screens.push({
        type: jsPsychHtmlKeyboardResponse,
        stimulus: "<div class='stm-digit stm-digit-blank'>&nbsp;</div>",
        choices: "NO_KEYS",
        trial_duration: stmSettings.blankMs,
        data: { task: "stm_blank" }
      });
    }
  });
  return screens;
}

function stmRecallScreen(sequence, phase, length, trialInLength) {
  return {
    type: jsPsychDigitKeypad,
    prompt: "Enter the digits in the order you saw them.",
    max_digits: stmSettings.maxLength + 2,
    data: { task: "stm_recall", phase: phase },
    on_finish: function (data) {
      var score = stmScoreResponse(sequence, data.response);
      var row = {
        length: length,
        trial_in_length: trialInLength,
        sequence: sequence,
        response: data.response,
        correct: score.correct,
        positions_correct: score.positions_correct,
        rt_ms: data.rt,
        edits: data.edits
      };
      data.sequence = sequence;
      data.correct = score.correct;
      data.positions_correct = score.positions_correct;

      if (phase === "practice") {
        stmPracticeRows.push(row);
        return;
      }

      stmMainRows.push(row);
      if (trialInLength === stmSettings.trialsPerLength) {
        var anyCorrect = stmMainRows.some(function (r) {
          return r.length === length && r.correct === 1;
        });
        if (!anyCorrect) {
          stmStopped = true;
        }
      }
    }
  };
}

function stmPracticeFeedback(sequence) {
  return {
    type: jsPsychHtmlButtonResponse,
    stimulus: function () {
      var last = stmPracticeRows[stmPracticeRows.length - 1];
      var spaced = sequence.split("").join(" ");
      if (last && last.correct === 1) {
        return "<div class='stm-text'><p class='stm-feedback stm-feedback-correct'>Correct!</p>" +
          "<p>The digits were <strong>" + spaced + "</strong>.</p>" +
          "<p>In the real task the lists start at 3 digits and get longer. Do your best on each one.</p></div>";
      }
      return "<div class='stm-text'><p class='stm-feedback stm-feedback-wrong'>Not quite.</p>" +
        "<p>The digits were <strong>" + spaced + "</strong>.</p>" +
        "<p>Enter them in the same order you saw them. In the real task the lists start at 3 digits and get longer.</p></div>";
    },
    choices: ["Begin the task"],
    data: { task: "stm_practice_feedback" }
  };
}

function stmMainFeedback() {
  return {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: function () {
      var last = stmMainRows[stmMainRows.length - 1];
      if (last && last.correct === 1) {
        return "<p class='stm-feedback stm-feedback-correct'>Correct</p>";
      }
      return "<p class='stm-feedback stm-feedback-wrong'>Not quite</p>";
    },
    choices: "NO_KEYS",
    trial_duration: stmSettings.feedbackMs,
    data: { task: "stm_feedback" }
  };
}

////////////////////////
// TIMELINE           //
////////////////////////

var stmTimeline = [];

stmTimeline.push({
  type: jsPsychHtmlButtonResponse,
  stimulus:
    "<div class='stm-text'>" +
    "<h2>Remembering Digits</h2>" +
    "<p>You will see a list of digits, shown one at a time in the middle of the screen.</p>" +
    "<p>After the last digit, use the keypad to enter the digits <strong>in the same order</strong> you saw them, then press <strong>Done</strong>.</p>" +
    "<p>Please do not write the digits down or say them out loud to anyone. Just keep them in your head.</p>" +
    "<p>First, a short practice list.</p>" +
    "</div>",
  choices: ["Start practice"],
  data: { task: "stm_instructions" }
});

stmTimeline.push(stmReadyScreen("Practice"));
stmTimeline = stmTimeline.concat(stmDigitScreens(stmPracticeSequence));
stmTimeline.push(stmRecallScreen(stmPracticeSequence, "practice", stmSettings.practiceLength, 1));
stmTimeline.push(stmPracticeFeedback(stmPracticeSequence));

var stmListNumber = 0;
for (var stmL = stmSettings.minLength; stmL <= stmSettings.maxLength; stmL++) {
  for (var stmT = 1; stmT <= stmSettings.trialsPerLength; stmT++) {
    stmListNumber += 1;
    var stmSequence = stmMainSequences[stmL][stmT - 1];
    var stmTrialNodes = [stmReadyScreen("List " + stmListNumber)]
      .concat(stmDigitScreens(stmSequence))
      .concat([stmRecallScreen(stmSequence, "main", stmL, stmT)]);
    if (stmSettings.showFeedback) {
      stmTrialNodes.push(stmMainFeedback());
    }
    stmTimeline.push({
      timeline: stmTrialNodes,
      conditional_function: function () {
        return !stmStopped;
      }
    });
  }
}

stmTimeline.push({
  type: jsPsychHtmlButtonResponse,
  stimulus: function () {
    var summary = stmComputeSummary();
    return "<div class='stm-text'>" +
      "<h2>All done</h2>" +
      "<p>Your digit span today:</p>" +
      "<p class='stm-span-score' id='stm-span-score'>" + summary.span + "</p>" +
      "<p>This is the longest list you recalled perfectly. Miller (1956) described short-term memory capacity as about 7, plus or minus 2, items.</p>" +
      "<p>We will look at the class results together.</p>" +
      "</div>";
  },
  choices: [stmFinishButtonLabel],
  data: { task: "stm_end" }
});

jsPsych.run(stmTimeline);
