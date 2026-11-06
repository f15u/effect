import { defineConcept } from "../../Concept.ts"
import { taggedErrors } from "../tagged-errors/concept.ts"

export const typedFailure = defineConcept({
  dir: import.meta.dirname,
  id: "typed-failure",
  title: "A function type that names how it can fail",
  needs: [taggedErrors],
  probe: {
    question:
      "authorizePayment can fail with an expired card, an invalid token or a network error. You write it with async and throw. What does its return type say about those failures?",
    correct:
      "Nothing. The type is Promise<Authorization>, so a caller must read the code to learn the failures.",
    distractors: [
      {
        text: "It lists the three error classes, because the function throws them.",
        belief: "A function type lists the errors the function throws.",
      },
      {
        text: "TypeScript marks the failures when the errors have _tag, even with throw.",
        belief: "A _tag on an error makes a thrown error show in the type.",
      },
    ],
  },
  keyIdea:
    "Effect<Success, Error> puts the failures in the type. Write the function with Effect.fn, and use `return yield* new MyError()` where you would throw. Effect reads the error types from the body.",
  hints: [
    "A thrown error cannot show in a type. What type could carry both a result and a failure?",
    'Replace the async arrow with `Effect.fn(function* (token: PaymentToken) { ... })`. Import Effect from "effect".',
    "Replace each `throw new X()` with `return yield* new X()`. Return the Authorization as a plain value.",
  ],
})
