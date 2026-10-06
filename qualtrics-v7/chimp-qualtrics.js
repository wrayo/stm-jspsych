Qualtrics.SurveyEngine.addOnload(function () {
  var qthis = this;
  var q$ = window.jQuery || window.$;

  var siteBaseUrl = "https://wrayo.github.io/stm-jspsych";
  var assetBaseUrl = siteBaseUrl + "/qualtrics-v7";
  var taskConfig = {
    displayElement: "display_stage",
    participantId: "${e://Field/ResponseID}",
    readyMs: 1000,
    feedbackMs: 800,
    revealMs: 1000,
    exposureMs: 0,
    minLength: 4,
    maxLength: 12,
    trialsPerLength: 2,
    practiceLength: 3,
    showFeedback: true,
    finishButtonLabel: "Continue"
  };

  function valueOrBlank(value) {
    return value === null || value === undefined ? "" : String(value);
  }

  function updateStatus(messageHtml) {
    var statusNode = document.getElementById("chimp-load-status");
    if (statusNode) {
      statusNode.innerHTML = messageHtml;
    }
  }

  function ensureStylesheet(href) {
    var existing = document.querySelector("link[data-chimp-href='" + href + "']");
    var link;

    if (existing) {
      return;
    }

    link = document.createElement("link");
    link.rel = "stylesheet";
    link.type = "text/css";
    link.href = href;
    link.setAttribute("data-chimp-href", href);
    document.head.appendChild(link);
  }

  // Stage CSS is injected here, not left to the theme, so Qualtrics skins cannot hide the task
  function ensureDisplayStageStyles() {
    var style;

    if (document.getElementById("chimp-display-stage-style")) {
      return;
    }

    style = document.createElement("style");
    style.id = "chimp-display-stage-style";
    style.textContent = [
      "#display_stage_background {",
      "  position: fixed !important;",
      "  left: 0 !important;",
      "  top: 0 !important;",
      "  width: 100vw !important;",
      "  height: 100vh !important;",
      "  background-color: #f6f7fb !important;",
      "  z-index: 2147483000 !important;",
      "}",
      "#display_stage {",
      "  position: fixed !important;",
      "  left: 1vw !important;",
      "  top: 1vh !important;",
      "  width: 98vw !important;",
      "  height: 98vh !important;",
      "  background: linear-gradient(180deg, #f6f7fb 0%, #edf1f7 100%) !important;",
      "  border-radius: 15px !important;",
      "  box-shadow: 1px 1px 1px #999 !important;",
      "  z-index: 2147483001 !important;",
      "  overflow-x: hidden !important;",
      "  overflow-y: auto !important;",
      "}",
      "#chimp-load-wrap {",
      "  position: relative !important;",
      "  z-index: 1 !important;",
      "}"
    ].join("\n");

    document.head.appendChild(style);
  }

  function ensureDisplayStage() {
    if (!document.getElementById("display_stage_background")) {
      q$("<div id='display_stage_background'></div>").appendTo("body");
    }
    if (!document.getElementById("display_stage")) {
      q$("<div id='display_stage'></div>").appendTo("body");
    }
  }

  function cleanup() {
    q$("#display_stage").remove();
    q$("#display_stage_background").remove();
  }

  function loadScript(index, resources) {
    q$.getScript(resources[index])
      .done(function () {
        if ((index + 1) < resources.length) {
          loadScript(index + 1, resources);
        }
      })
      .fail(function () {
        cleanup();
        updateStatus(
          "The number grid task could not finish loading.<br>" +
          "Please contact the instructional team."
        );
      });
  }

  if (!q$) {
    updateStatus(
      "The Qualtrics page libraries did not load correctly.<br>" +
      "Please contact the instructional team."
    );
    return;
  }

  qthis.hideNextButton();
  ensureDisplayStageStyles();
  ensureDisplayStage();
  ensureStylesheet(assetBaseUrl + "/lib/jspsych-7.3.1/jspsych.css");
  ensureStylesheet(assetBaseUrl + "/chimp.css");

  window.chimpTaskConfig = taskConfig;
  window.chimpTaskHooks = {
    onFinish: function (jsPsychInstance, payload) {
      var prefix = "chimp_";

      Qualtrics.SurveyEngine.setEmbeddedData(prefix + "participant_id", valueOrBlank(payload.participant_id));
      Qualtrics.SurveyEngine.setEmbeddedData(prefix + "span", valueOrBlank(payload.span));
      Qualtrics.SurveyEngine.setEmbeddedData(prefix + "total_correct", valueOrBlank(payload.total_correct));
      Qualtrics.SurveyEngine.setEmbeddedData(prefix + "trials_completed", valueOrBlank(payload.trials_completed));
      Qualtrics.SurveyEngine.setEmbeddedData(prefix + "max_length_reached", valueOrBlank(payload.max_length_reached));
      Qualtrics.SurveyEngine.setEmbeddedData(prefix + "duration_ms", valueOrBlank(payload.duration_ms));
      Qualtrics.SurveyEngine.setEmbeddedData(prefix + "device_touch", valueOrBlank(payload.device_touch));
      Qualtrics.SurveyEngine.setEmbeddedData(prefix + "summary_json", JSON.stringify(payload.summary || {}));
      Qualtrics.SurveyEngine.setEmbeddedData(prefix + "practice_json", JSON.stringify(payload.practice || []));
      Qualtrics.SurveyEngine.setEmbeddedData(prefix + "trials_json", JSON.stringify(payload.trials || []));

      cleanup();
      qthis.clickNextButton();
    }
  };

  if (window.Qualtrics && (!window.frameElement || window.frameElement.id !== "mobile-preview-view")) {
    loadScript(0, [
      assetBaseUrl + "/lib/jspsych-7.3.1/jspsych.js",
      assetBaseUrl + "/lib/jspsych-7.3.1/plugin-html-button-response.js",
      assetBaseUrl + "/lib/jspsych-7.3.1/plugin-html-keyboard-response.js",
      assetBaseUrl + "/chimp-v7-task.js"
    ]);
  }
});

Qualtrics.SurveyEngine.addOnReady(function () {
});

Qualtrics.SurveyEngine.addOnUnload(function () {
  var q$ = window.jQuery || window.$;
  if (q$) {
    q$("#display_stage").remove();
    q$("#display_stage_background").remove();
  }
  delete window.chimpTaskConfig;
  delete window.chimpTaskHooks;
  delete window.chimpTaskLastRun;
});
