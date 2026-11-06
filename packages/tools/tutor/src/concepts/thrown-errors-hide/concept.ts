import { defineConcept } from "../../Concept.ts"

export const thrownErrorsHide = defineConcept({
  dir: import.meta.dirname,
  id: "thrown-errors-hide",
  title: "Seeing why a thrown error is invisible",
  needs: [],
  probe: {
    question:
      "authorizePayment throws three errors. Someone adds a fourth throw. processPayment has no handler for it. What does TypeScript say?",
    correct:
      "Nothing. The type Promise<Authorization> does not list errors, so the code compiles.",
    distractors: [
      {
        text: "A compile error, because the catch block misses an error.",
        belief:
          "TypeScript checks that a catch block handles every thrown error.",
      },
      {
        text: "No compile error, but the catch variable has the union of all thrown errors.",
        belief:
          "The type of a catch variable tracks what the try block throws.",
      },
    ],
  },
  keyIdea:
    "A thrown error is not part of a function's type. The catch variable is unknown. TypeScript cannot find a missing handler, an extra handler, or a new error that nobody handles.",
  hints: [
    "Run processPayment with tok_timeout and read what happens. Which branch of the catch block runs?",
    "Add a branch for NetworkError. Check the instance with `instanceof`.",
    'Return `new Response("Payment provider unavailable", { status: 503 })` from that branch.',
  ],
})
