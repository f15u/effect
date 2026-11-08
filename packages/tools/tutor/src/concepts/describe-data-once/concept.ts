import { defineConcept } from "../../Concept.ts"
import { trustNothingFromOutside } from "../trust-nothing-from-outside/concept.ts"

export const describeDataOnce = defineConcept({
  dir: import.meta.dirname,
  id: "describe-data-once",
  title: "Describing data once with a Schema",
  needs: [trustNothingFromOutside],
  probe: {
    question:
      "You have an `interface Payment` and a hand-written `isPayment(x): x is Payment`. Someone adds a field to the interface. What happens?",
    correct: "Nothing warns you. The check can miss the field, because TypeScript trusts the type predicate.",
    distractors: [
      {
        text: "A compile error, because TypeScript checks that isPayment matches the interface.",
        belief: "A type predicate is verified against the type."
      },
      {
        text: "The check updates itself, because both use the name Payment.",
        belief: "A type and a function with the same name stay linked."
      }
    ]
  },
  keyIdea:
    "A Schema describes the shape of data once. From the one description you get the TypeScript type with `typeof Payment.Type`, and a validator that checks values at runtime. Schema.Struct describes an object, and Schema.String and Schema.Number describe its fields. Schema.decodeUnknownSync(Payment) checks an unknown value and throws if it is wrong. The type and the check cannot disagree.",
  hints: [
    "The test uses `Payment` as a value, and an interface is only a type. Which Effect module describes data as a value?",
    "Define `Payment` with `Schema.Struct({ ... })`, and keep the type with `export type Payment = typeof Payment.Type`.",
    "The fields are `amount: Schema.Number` and `token: Schema.String`."
  ]
})
