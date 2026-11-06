import { defineConcept } from "../../Concept.ts"
import { bugIsNotAnError } from "../bug-is-not-an-error/concept.ts"
import { handleOneError } from "../handle-one-error/concept.ts"

export const triageFailures = defineConcept({
  dir: import.meta.dirname,
  id: "triage-failures",
  title: "Telling a failure from a bug",
  goal: "Tell a failure from a bug",
  needs: [bugIsNotAnError, handleOneError],
  probe: {
    question:
      "The provider returns a status that the code does not know. No caller can fix that. Where does it belong?",
    correct:
      "It is a bug. It stops the work as a defect and stays out of the type.",
    distractors: [
      {
        text: "In the Error type, so every caller sees it.",
        belief: "Every problem belongs in the Error type.",
      },
      {
        text: "Nowhere. The code ignores it and goes on.",
        belief: "Unknown input is safe to ignore.",
      },
    ],
  },
  keyIdea:
    "Ask three questions. Can a caller recover? Then it is a typed error. Is it a normal result, such as a declined card? Then it is a success value. Is it a broken rule that no caller can fix? Then it is a defect, and Effect.die stops the work.",
  hints: [
    "For each function, ask: can a caller recover, is it a normal result, or is it a bug?",
    "A typed error uses `Effect.fail`. A bug uses `Effect.die`. A normal result uses `Effect.succeed`.",
    "`checkExpiry` must fail with a typed ExpiredCardError. `readStatus` must die on an unknown status. `answerTimeout` uses `Effect.catchTag`. `describe` must succeed for both statuses.",
  ],
})
