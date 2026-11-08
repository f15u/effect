import { defineConcept } from "../../Concept.ts"
import { functionsWithEffectFn } from "../functions-with-effect-fn/concept.ts"

export const transformWithPipe = defineConcept({
  dir: import.meta.dirname,
  id: "transform-with-pipe",
  title: "Changing the result of an Effect with map, flatMap and pipe",
  goal: "Read and write basic Effect code",
  needs: [functionsWithEffectFn],
  probe: {
    question: "You have an `Effect<number>` and you call `Effect.map((n) => n + 1)` on it. What do you get?",
    correct: "A new Effect<number> that adds one when it runs. Nothing ran yet.",
    distractors: [
      {
        text: "A number, because map runs the Effect and unwraps the value.",
        belief: "Effect.map works like Array.map on a finished value."
      },
      {
        text: "A Promise<number> that you must await.",
        belief: "An Effect turns into a Promise when you transform it."
      }
    ]
  },
  keyIdea:
    "Effect.map changes the success value with a plain function. Effect.flatMap changes it with a function that returns another Effect, so one step can depend on the next. `effect.pipe(Effect.map(f), Effect.flatMap(g))` reads top to bottom. Both return a new Effect and run nothing. Effect.gen and pipe give the same result: use gen for steps in order, and pipe for a short change to one value.",
  hints: [
    "`receiptText` must run `chargeCard`, then `sendReceipt`, then format the text. Which two functions chain Effects and change a value?",
    "Pipe `chargeCard(amount)` into `Effect.flatMap` for the receipt, then into `Effect.map` for the text.",
    "`Effect.flatMap((charge) => sendReceipt(charge))` then `Effect.map((id) => `Receipt ${id}`)`."
  ]
})
