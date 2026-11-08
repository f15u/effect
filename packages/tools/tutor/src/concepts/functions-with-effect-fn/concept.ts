import { defineConcept } from "../../Concept.ts"
import { sequenceWithGen } from "../sequence-with-gen/concept.ts"

export const functionsWithEffectFn = defineConcept({
  dir: import.meta.dirname,
  id: "functions-with-effect-fn",
  title: "Defining named functions that return an Effect",
  needs: [sequenceWithGen],
  probe: {
    question:
      "You write `Effect.fn(\"checkout\")(function*(amount: number) { ... })` instead of `(amount: number) => Effect.gen(function*() { ... })`. What do you gain?",
    correct: "A named function. Each call is a span called checkout in traces, and errors show it in the stack.",
    distractors: [
      {
        text: "It retries the steps when one of them fails.",
        belief: "Effect.fn adds retries."
      },
      {
        text: "It saves the result for each amount, so the second call is faster.",
        belief: "Effect.fn caches results."
      }
    ]
  },
  keyIdea:
    "Effect.fn(\"name\")(function*(args) { ... }) defines a function that returns an Effect. It takes the arguments directly, so you need no outer arrow function. The name opens a span for each call, which tracing tools and stack traces show. Use Effect.fn for every function that returns an Effect.",
  hints: [
    "`checkout` is an arrow function that returns `Effect.gen`. Which Effect function defines a function and takes the arguments directly?",
    "Write `Effect.fn(\"checkout\")(function*(amount: number) { ... })`.",
    "Keep the body as it is. Move `amount` into the generator parameters and drop the outer arrow."
  ]
})
