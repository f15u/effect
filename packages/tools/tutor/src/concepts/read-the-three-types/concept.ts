import { defineConcept } from "../../Concept.ts"
import { runAtTheEdge } from "../run-at-the-edge/concept.ts"

export const readTheThreeTypes = defineConcept({
  dir: import.meta.dirname,
  id: "read-the-three-types",
  title: "Reading Effect<Success, Error, Requirements>",
  needs: [runAtTheEdge],
  probe: {
    question: "`declined` has the type `Effect<never, DeclinedError>`. What does `never` in the first slot tell you?",
    correct: "The Effect never succeeds with a value. It can only fail.",
    distractors: [
      {
        text: "It succeeds with no value, like void.",
        belief: "never means an empty value, the same as void."
      },
      {
        text: "The type is wrong, and TypeScript rejects it.",
        belief: "never always marks a type error."
      }
    ]
  },
  keyIdea:
    "Effect<Success, Error, Requirements> has three slots. Success is the value when it works. Error is the failures you expect. Requirements is what the Effect needs from outside before it can run. never in a slot means nothing: never in Error means it cannot fail, and never in Requirements means it needs nothing. Effect.succeed has Error never. Effect.fail has Success never.",
  hints: [
    "Both annotations say `unknown`. Read what each Effect does: does it succeed, fail, or both?",
    "`receipt` always succeeds, so its Error slot is `never`. `declined` never succeeds, so its Success slot is `never`.",
    "Write `Effect.Effect<Receipt, never>` for `receipt` and `Effect.Effect<never, DeclinedError>` for `declined`."
  ]
})
