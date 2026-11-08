import { defineConcept } from "../../Concept.ts"
import { readTheThreeTypes } from "../read-the-three-types/concept.ts"

export const sequenceWithGen = defineConcept({
  dir: import.meta.dirname,
  id: "sequence-with-gen",
  title: "Writing steps in order with Effect.gen and yield*",
  needs: [readTheThreeTypes],
  probe: {
    question: "Inside Effect.gen, what does `const charge = yield* chargeCard(50)` do?",
    correct: "It runs chargeCard as one step. charge holds the success value.",
    distractors: [
      {
        text: "It gives charge an Effect that you must run later.",
        belief: "yield* returns the Effect itself, not its result."
      },
      {
        text: "It gives charge a Promise that you must await.",
        belief: "yield* is a second spelling of await for Promises."
      }
    ]
  },
  keyIdea:
    "Effect.gen takes a generator function. In it, `yield*` works like `await`: it runs an Effect as a step and gives you the success value. You write the steps in order, as in async code, and the result is still an Effect that describes the work. If a step fails, the later steps do not run.",
  hints: [
    "`checkout` returns a fixed value. It must charge the card first, then send the receipt. What gives you steps in order?",
    "Write `Effect.gen(function*() { ... })`. Use `yield*` before each call that returns an Effect.",
    "Charge with `yield* chargeCard(amount)`. Send with `yield* sendReceipt(charge)`. Return the receipt id."
  ]
})
