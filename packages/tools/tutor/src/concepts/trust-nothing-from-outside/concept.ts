import { defineConcept } from "../../Concept.ts"

export const trustNothingFromOutside = defineConcept({
  dir: import.meta.dirname,
  id: "trust-nothing-from-outside",
  title: "Seeing why data from outside cannot be trusted",
  needs: [],
  probe: {
    question:
      "`readPayment` calls `JSON.parse` and returns a `Payment`. A client sends `{\"amount\":\"5\"}`. What happens?",
    correct: "TypeScript accepts it. The wrong value moves on and breaks later, far from the cause.",
    distractors: [
      {
        text: "A compile error, because amount is a string and not a number.",
        belief: "TypeScript sees the shape of data that arrives at runtime."
      },
      {
        text: "JSON.parse throws, because the amount has the wrong type.",
        belief: "JSON.parse checks values against the expected type."
      }
    ]
  },
  keyIdea:
    "JSON.parse returns any, and a type annotation on the result is a promise that nothing checks. Data from a client, a file or a database is only text until you check it. If you do not check at the edge, a wrong value breaks something later, and the error does not point to the real cause. A hand-written check works, but it repeats the type and can drift from it. The next concepts show a better tool.",
  hints: [
    "Call `readPayment` with `{\"amount\":\"5\",\"token\":\"tok\"}`. What type does the amount have in the result?",
    "Check the parsed value before you return it: is `amount` a number, and is `token` a string?",
    "Return `undefined` when a check fails. Test `typeof value.amount === \"number\"` and `typeof value.token === \"string\"`, and that `value` is an object."
  ]
})
