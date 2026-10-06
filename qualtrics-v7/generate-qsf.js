const fs = require("fs");
const path = require("path");

// Builds Digit_Span.qsf and Chimp_Task.qsf from a known-good 3-question task survey
// (Welcome -> Embedded Data -> Task -> Completion). Run: node qualtrics-v7/generate-qsf.js

const currentDir = __dirname;
const templatePath = path.resolve(currentDir, "../templates/base.qsf");

const fieldSuffixes = [
  "participant_id",
  "span",
  "total_correct",
  "trials_completed",
  "max_length_reached",
  "duration_ms",
  "device_touch",
  "summary_json",
  "practice_json",
  "trials_json",
];

const surveys = [
  {
    outputFile: "Digit_Span.qsf",
    surveyName: "Digit Span",
    filePrefix: "stm",
    fieldPrefix: "stm_",
    taskBlock: "Digit Span Task",
    welcomeTitle: "Welcome to the Digit Memory Task",
    loadingText: "The digit memory task is loading.",
    taskDescription: "Digit span task",
    taskExportTag: "DigitSpanTask",
    completeTitle: "Digit memory task complete",
  },
  {
    outputFile: "Chimp_Task.qsf",
    surveyName: "Number Grid Memory",
    filePrefix: "chimp",
    fieldPrefix: "chimp_",
    taskBlock: "Number Grid Task",
    welcomeTitle: "Welcome to the Number Grid Memory Task",
    loadingText: "The number grid task is loading.",
    taskDescription: "Number grid (chimp) task",
    taskExportTag: "NumberGridTask",
    completeTitle: "Number grid task complete",
  },
];

const readText = (fileName) =>
  fs.readFileSync(path.join(currentDir, fileName), "utf8").trim();

const makeEmbeddedField = (field) => ({
  Description: field,
  Type: "Recipient",
  Field: field,
  VariableType: "String",
  DataVisibility: [],
  AnalyzeText: false,
});

function buildQsf(spec) {
  const introHtml = readText(spec.filePrefix + "-intro.html");
  const questionHtml = readText(spec.filePrefix + "-question.html");
  const questionJs = readText(spec.filePrefix + "-qualtrics.js");
  const endHtml = readText(spec.filePrefix + "-end.html");
  const template = JSON.parse(fs.readFileSync(templatePath, "utf8"));
  const embeddedFieldNames = fieldSuffixes.map((suffix) => spec.fieldPrefix + suffix);

  template.SurveyEntry.SurveyName = spec.surveyName;
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
  taskBlock.Description = spec.taskBlock;
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
      element.Payload.SurveyTitle = spec.surveyName;
    }

    if (element.Element === "SQ" && element.PrimaryAttribute === "QID1") {
      element.SecondaryAttribute = spec.welcomeTitle;
      element.Payload.QuestionText = introHtml;
      element.Payload.QuestionDescription = spec.welcomeTitle;
      element.Payload.DataExportTag = "Welcome";
      delete element.Payload.QuestionJS;
    }

    if (element.Element === "SQ" && element.PrimaryAttribute === "QID2") {
      element.SecondaryAttribute = spec.loadingText;
      element.Payload.QuestionText = questionHtml;
      element.Payload.QuestionDescription = spec.taskDescription;
      element.Payload.QuestionJS = questionJs;
      element.Payload.DataExportTag = spec.taskExportTag;
    }

    if (element.Element === "SQ" && element.PrimaryAttribute === "QID3") {
      element.SecondaryAttribute = spec.completeTitle;
      element.Payload.QuestionText = endHtml;
      element.Payload.QuestionDescription = spec.completeTitle;
      element.Payload.DataExportTag = "Complete";
      delete element.Payload.QuestionJS;
    }
  });

  const outputPath = path.join(currentDir, spec.outputFile);
  fs.writeFileSync(outputPath, JSON.stringify(template));
  console.log("Generated:", outputPath);
}

surveys.forEach(buildQsf);
