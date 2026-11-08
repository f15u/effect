import { defineConcept } from "../../Concept.ts"
import { namedErrors } from "../named-errors/concept.ts"

export const errorsInTheType = defineConcept({
  dir: import.meta.dirname,
  id: "errors-in-the-type",
  title: "Showing every failure in the type",
  goal: "Know every way my code can fail",
  needs: [namedErrors],
  probe: {
    question:
      "processPayment calls authorizePayment with yield*. authorizePayment can fail three ways. processPayment adds no error of its own. What does its Error type say?",
    correct: "The same three errors. A caller that uses yield* inherits them.",
    distractors: [
      {
        text: "never, because processPayment does not raise an error itself.",
        belief: "An error stays with the function that raises it."
      },
      {
        text: "unknown, because TypeScript cannot follow a function call.",
        belief: "Types do not pass through a function call."
      }
    ]
  },
  keyIdea:
    "Effect<Success, Error> puts the failures in the type. Define the function with Effect.fn, as you learned, and write `return yield* new MyError()` where you would throw. A caller that uses yield* inherits the error union, so a new error changes the type of every caller.",
  hints: [
    "A Promise cannot carry an error in its type. Which type can?",
    "Define each function with `Effect.fn`, and use `yield*` where you used `await`.",
    "Replace `throw new X()` with `return yield* new X()`. In `processPayment`, write `yield* authorizePayment(token)`."
  ]
})
