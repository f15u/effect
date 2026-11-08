import { defineConcept } from "../../Concept.ts"
import { giveUpOnPurpose } from "../give-up-on-purpose/concept.ts"

export const containADefect = defineConcept({
  dir: import.meta.dirname,
  id: "contain-a-defect",
  title: "Containing an unexpected failure at a boundary",
  goal: "Decide where a failure ends",
  needs: [giveUpOnPurpose],
  probe: {
    question:
      "A payment is captured twice by mistake. This is a bug, not a normal failure. An HTTP handler is the boundary. What should it do?",
    correct:
      "Check at runtime that it knows this defect. Answer with a 500 reply for it, and stop on any other defect.",
    distractors: [
      {
        text: "Turn it into a typed error, so every caller must handle it.",
        belief: "A defect should become a typed error."
      },
      {
        text: "Catch every defect and answer with a 500 reply, so nothing ever stops.",
        belief: "catchDefect may swallow every defect."
      },
      {
        text: "Catch it and run the rest of the payment code.",
        belief: "catchDefect resumes the code after the defect."
      }
    ]
  },
  keyIdea:
    "A defect stops the work. Only a boundary, such as an HTTP handler, contains it. Effect.catchDefect gives the handler a value of type unknown. The handler checks the value at runtime, answers for the defects it knows, and sends all other defects back with Effect.die. The handler replaces the stopped work. It does not resume it.",
  hints: [
    "Which Effect function runs a handler for defects only, and leaves typed errors alone?",
    "Pipe `self` into `Effect.catchDefect`. The handler receives `unknown`. How do you check that it is a DoubleCaptureError?",
    "Use `instanceof DoubleCaptureError`. For it, return `Effect.succeed(new Response(..., { status: 500 }))`. For all other defects, return `Effect.die(defect)`."
  ]
})
