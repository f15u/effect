import { defineConcept } from "../../Concept.ts"
import { encodeForTheWire } from "../encode-for-the-wire/concept.ts"

export const refineAndBrand = defineConcept({
  dir: import.meta.dirname,
  id: "refine-and-brand",
  title: "Putting business rules in the Schema",
  needs: [encodeForTheWire],
  probe: {
    question:
      "`amount: Schema.Number` accepts -50. The business says an amount is above zero. Where should the rule live?",
    correct: "In the Schema, as a check on the field. Then every decoder enforces it.",
    distractors: [
      {
        text: "In the handler that uses the amount, after decoding.",
        belief: "A Schema checks only types, and rules belong in handlers."
      },
      {
        text: "In the type, with a comment that says the amount must be positive.",
        belief: "A comment on a type makes the compiler enforce the rule."
      }
    ]
  },
  keyIdea:
    "A type such as number allows many wrong values. A check narrows it: `Schema.Number.check(Schema.isGreaterThan(0))` accepts only amounts above zero, and decoding rejects the rest with a message. A brand gives a plain value a name in the type: `Schema.String.pipe(Schema.brand(\"PaymentToken\"))` is still a string at runtime, but TypeScript no longer accepts any string where a PaymentToken is wanted. You get a value of that type only by decoding it.",
  hints: [
    "Two rules are missing: the amount is above zero, and the token is not just any string. Take the amount first. Which method adds a check to a Schema?",
    "Use `Schema.Number.check(Schema.isGreaterThan(0))` for `amount`.",
    "For the token, make `PaymentToken = Schema.String.pipe(Schema.brand(\"PaymentToken\"))` and use it in the struct."
  ]
})
