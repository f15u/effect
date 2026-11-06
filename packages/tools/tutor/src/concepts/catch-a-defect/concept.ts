import { defineConcept } from "../../Concept.ts"
import { taggedErrors } from "../tagged-errors/concept.ts"

export const catchADefect = defineConcept({
  dir: import.meta.dirname,
  id: "catch-a-defect",
  title: "Containing an unexpected failure at a boundary",
  goal: "Keep a server alive when something unexpected breaks",
  needs: [taggedErrors],
  probe: {
    question:
      "A payment is captured twice by mistake. This is a bug, not a normal failure. What should happen with it?",
    correct:
      "It stays out of the function's type and stops that work. A boundary, such as an HTTP handler, contains it.",
    distractors: [
      {
        text: "It becomes a typed error, so every caller must handle it.",
        belief: "A defect should be a typed error that the caller handles.",
      },
      {
        text: "Someone catches it, and the code after the bug runs on.",
        belief: "catchDefect resumes the code after the defect.",
      },
      {
        text: "Every layer catches every bug, so nothing ever stops.",
        belief: "catchDefect may swallow every defect.",
      },
    ],
  },
  keyIdea:
    "Expected errors go in the type, so a caller can recover. Bugs and broken invariants are defects: they stay out of the type and stop the computation. Only a boundary, such as an HTTP handler, contains them. Effect.catchDefect receives unknown, checks it at runtime, and sends unknown defects back with Effect.die.",
  wrongBeliefs: [
    "A defect should be a typed error that the caller handles.",
    "catchDefect resumes the code after the defect. (It only gives the wrapped Effect a new outcome.)",
    "catchDefect may swallow every defect. (It must send unknown ones back to Effect.die.)",
  ],
  hints: [
    "Which Effect function runs a handler for defects only, and leaves expected errors alone?",
    "Pipe `self` into `Effect.catchDefect`. The handler receives `unknown`. How do you check the value is a DoubleCaptureError at runtime?",
    "Use `instanceof DoubleCaptureError`. For it, return `Effect.succeed(new Response(..., { status: 500 }))`. For every other defect, return `Effect.die(defect)`.",
  ],
})
