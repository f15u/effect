import { defineConcept } from "../../Concept.ts"
import { typedFailure } from "../typed-failure/concept.ts"

export const stopOnBrokenRule = defineConcept({
  dir: import.meta.dirname,
  id: "stop-on-broken-rule",
  title: "Stopping when a rule that must hold breaks",
  needs: [typedFailure],
  probe: {
    question:
      "An authorization must be captured only once. Code finds a second capture. No caller can fix this. How should the code report it?",
    correct:
      "Stop the work with Effect.die. The problem stays out of the Error type.",
    distractors: [
      {
        text: "Add it to the Error type, so every caller must handle it.",
        belief: "Every problem belongs in the Error type.",
      },
      {
        text: "Return a normal value and let the work go on.",
        belief: "The work can safely go on after a broken rule.",
      },
    ],
  },
  keyIdea:
    "Expected errors go in the Error type because a caller can recover. A broken rule is a defect: Effect.die stops the work, and the defect does not enter the Error type. Effect<A, never> can still stop with a defect.",
  hints: [
    "The error should leave the type. Which Effect function stops the work with a defect?",
    "Wrap the error: `Effect.die(new DoubleCaptureError({ id: authorization.id }))`.",
    "Keep `return yield*` in front: `return yield* Effect.die(new DoubleCaptureError({ id: authorization.id }))`.",
  ],
})
