import { defineConcept } from "../../Concept.ts"
import { errorsInTheType } from "../errors-in-the-type/concept.ts"

export const bugIsNotAnError = defineConcept({
  dir: import.meta.dirname,
  id: "bug-is-not-an-error",
  title: "Stopping on a broken rule",
  needs: [errorsInTheType],
  probe: {
    question:
      "capturePayment finds that an authorization was already captured. A second capture can charge the customer twice. No caller can fix that. Where does this problem belong?",
    correct: "It is a defect. It stops the work and stays out of the Error type.",
    distractors: [
      {
        text: "In the Error type, so every caller must handle it.",
        belief: "Every problem belongs in the Error type."
      },
      {
        text: "In the success value, as a flag that the caller checks.",
        belief: "A broken rule can be reported as a normal result."
      }
    ]
  },
  keyIdea:
    "An expected error goes in the Error type because a caller can recover. A broken rule is a defect. Effect.die stops the work, and the defect does not enter the Error type. An Effect<A, never> can still stop with a defect.",
  hints: [
    "The caller cannot recover. The error should leave the type. Which function stops the work with a defect?",
    "Use `Effect.die(...)` and give it the error value. Keep `yield*` in front.",
    "Write `return yield* Effect.die(new DoubleCaptureError({ id: authorization.id }))`."
  ]
})
