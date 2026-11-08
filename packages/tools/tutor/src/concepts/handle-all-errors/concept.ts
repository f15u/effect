import { defineConcept } from "../../Concept.ts"
import { handleOneError } from "../handle-one-error/concept.ts"

export const handleAllErrors = defineConcept({
  dir: import.meta.dirname,
  id: "handle-all-errors",
  title: "Answering every failure at once",
  goal: "Answer each failure and let the compiler check me",
  needs: [handleOneError],
  probe: {
    question: "processPayment can fail three ways. You answer all three. What is the Error type of the new Effect?",
    correct: "never. No expected error is left for the caller.",
    distractors: [
      {
        text: "Still the three errors, until the code runs.",
        belief: "Types change only at runtime, so handled errors stay in the type."
      },
      {
        text: "unknown, because a handler can return anything.",
        belief: "A handler makes the error type unknown."
      }
    ]
  },
  keyIdea:
    "Effect.catchTags takes one object. Each key is a _tag, each value a handler. TypeScript checks every key. When you handle all errors, the Error type is never. If someone adds a new error later, the type is no longer never, and the compiler shows where the handler is missing.",
  hints: [
    "One call can take handlers for several tags. Which function name ends in an s?",
    "Pipe `self` into `Effect.catchTags({ ExpiredCardError: ..., InvalidTokenError: ..., NetworkError: ... })`.",
    "Each handler returns `Effect.succeed(new Response(text, { status }))`. Use 402, 400 and 503."
  ]
})
