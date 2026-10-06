const fs = require("fs");
const path = require("path");

// Builds Digit_Span.qsf from a known-good 3-question task survey
// (Welcome -> Embedded Data -> Task -> Completion). Run: node qualtrics-v7/generate-stm-qsf.js

const currentDir = __dirname;
const templatePath = path.resolve(currentDir, "../templates/base.qsf");
const outputPath = path.join(currentDir, "Digit_Span.qsf");

const surveyName = "Digit Span";

const readText = (fileName) =>
  fs.readFileSync(path.join(currentDir, fileName), "utf8").trim();

const introHtml = readText("stm-intro.html");
const questionHtml = readText("stm-question.html");
const questionJs = readText("stm-qualtrics.js");
const endHtml = readText("stm-end.html");
const template = JSON.parse(fs.readFileSync(templatePath, "utf8"));

const embeddedFieldNames = [
  "stm_participant_id",
  "stm_span",
  "stm_total_correct",
  "stm_trials_completed",
  "stm_max_length_reached",
  "stm_duration_ms",
  "stm_device_touch",
  "stm_summary_json",
  "stm_practice_json",
  "stm_trials_json",
];

const makeEmbeddedField = (field) => ({
  Description: field,
  Type: "Recipient",
  Field: field,
  VariableType: "String",
  DataVisibility: [],
  AnalyzeText: false,
});

template.SurveyEntry.SurveyName = surveyName;
template.SurveyEntry.SurveyStatus = "Inactive";

const blocksElement = template.SurveyElements.find(
  (element) => element.Element === "BL"
);
const findBlockFor = (qid) =>
  blocksElement.Payload.find((block) =>
    (block.BlockElements || []).some((item) => item.QuestionID === qid)
  );
const introBlock = findBlockFor("QID1");
const taskBlock = findBlockFor("QID2");
const completionBlock = findBlockFor("QID3");

introBlock.Description = "Welcome";
taskBlock.Description = "Digit Span Task";
completionBlock.Description = "Completion";

template.SurveyElements.forEach((element) => {
  if (element.Element === "FL") {
    element.Payload.Flow = [
      { Type: "Block", ID: introBlock.ID, FlowID: "FL_2", Autofill: [] },
      {
        Type: "EmbeddedData",
        FlowID: "FL_3",
        EmbeddedData: embeddedFieldNames.map(makeEmbeddedField),
      },
      { Type: "Standard", ID: taskBlock.ID, FlowID: "FL_4" },
      { Type: "Standard", ID: completionBlock.ID, FlowID: "FL_5" },
    ];
    element.Payload.Properties.Count = 4;
  }

  if (element.Element === "SO") {
    element.Payload.NoIndex = "Yes";
    element.Payload.SurveyTitle = surveyName;
  }

  if (element.Element === "SQ" && element.PrimaryAttribute === "QID1") {
    element.SecondaryAttribute = "Welcome to the Digit Memory Task";
    element.Payload.QuestionText = introHtml;
    element.Payload.QuestionDescription = "Welcome to the Digit Memory Task";
    element.Payload.DataExportTag = "Welcome";
    delete element.Payload.QuestionJS;
  }

  if (element.Element === "SQ" && element.PrimaryAttribute === "QID2") {
    element.SecondaryAttribute = "The digit memory task is loading.";
    element.Payload.QuestionText = questionHtml;
    element.Payload.QuestionDescription = "Digit span task";
    element.Payload.QuestionJS = questionJs;
    element.Payload.DataExportTag = "DigitSpanTask";
  }

  if (element.Element === "SQ" && element.PrimaryAttribute === "QID3") {
    element.SecondaryAttribute = "Digit memory task complete";
    element.Payload.QuestionText = endHtml;
    element.Payload.QuestionDescription = "Digit memory task complete";
    element.Payload.DataExportTag = "Complete";
    delete element.Payload.QuestionJS;
  }
});

fs.writeFileSync(outputPath, JSON.stringify(template));
console.log("Generated:", outputPath);
