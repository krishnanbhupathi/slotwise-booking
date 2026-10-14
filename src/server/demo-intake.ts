import type { IntakeAnswers, IntakeFormRef } from "@/db/schema";

/**
 * The demo's Physics intake form: a copy of a real form published on Formwise
 * (jmdpq5gycd). Kept here so the nightly demo reset never depends on the network;
 * the tutor's "Refresh" button fetches the live version.
 */
export const DEMO_INTAKE_FORM: Omit<IntakeFormRef, "fetchedAt"> = {
  formId: "jmdpq5gycd",
  version: 1,
  sourceUrl: "https://formwise-builder.vercel.app/f/jmdpq5gycd",
  schema: {
    "version": 1,
    "id": "jmdpq5gycd",
    "title": "Before your first lesson",
    "description": "Helps your tutor plan the session.",
    "fields": [
      {
        "id": "f_year",
        "type": "select",
        "label": "School year",
        "required": true,
        "options": [
          {
            "id": "f_year_o1",
            "label": "Year 10"
          },
          {
            "id": "f_year_o2",
            "label": "Year 11"
          },
          {
            "id": "f_year_o3",
            "label": "Year 12"
          },
          {
            "id": "f_year_o4",
            "label": "Year 13"
          },
          {
            "id": "f_year_o5",
            "label": "Other"
          }
        ]
      },
      {
        "id": "f_exam",
        "type": "checkbox",
        "label": "Preparing for an exam this year",
        "required": false
      },
      {
        "id": "f_board",
        "type": "select",
        "label": "Exam board",
        "required": true,
        "showIf": {
          "fieldId": "f_exam",
          "equals": true
        },
        "options": [
          {
            "id": "f_board_o1",
            "label": "AQA"
          },
          {
            "id": "f_board_o2",
            "label": "Edexcel"
          },
          {
            "id": "f_board_o3",
            "label": "OCR"
          },
          {
            "id": "f_board_o4",
            "label": "Not sure"
          }
        ]
      },
      {
        "id": "f_topics",
        "type": "textarea",
        "label": "Topics to focus on",
        "required": false,
        "maxLength": 1000,
        "placeholder": "e.g. circular motion, practical write-ups"
      },
      {
        "id": "f_consent",
        "type": "checkbox",
        "label": "A parent or guardian agrees to these lessons",
        "required": true
      }
    ]
  },
};

/** Sample answers for the demo Physics booking. */
export const DEMO_INTAKE_ANSWERS: IntakeAnswers = {
  formId: "jmdpq5gycd",
  version: 1,
  title: "Before your first lesson",
  answers: [
    { id: "f_year", label: "School year", value: "Year 12" },
    { id: "f_exam", label: "Preparing for an exam this year", value: true },
    { id: "f_board", label: "Exam board", value: "OCR" },
    { id: "f_topics", label: "Topics to focus on", value: "Circular motion and required practicals." },
    { id: "f_consent", label: "A parent or guardian agrees to these lessons", value: true },
  ],
};
