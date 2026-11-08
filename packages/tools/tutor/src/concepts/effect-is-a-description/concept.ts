import { defineConcept } from "../../Concept.ts"

export const effectIsADescription = defineConcept({
  dir: import.meta.dirname,
  id: "effect-is-a-description",
  title: "Seeing that an Effect describes work and does not run it",
  needs: [],
  probe: {
    question:
      "You write `const job = Effect.sync(() => console.log(\"hi\"))` and never run it. What does the program print?",
    correct: "Nothing. An Effect is a description of work. It runs only when you run it.",
    distractors: [
      {
        text: "hi, once, when the line runs.",
        belief: "Creating an Effect runs it, as calling a function or creating a Promise does."
      },
      {
        text: "hi, once, when the program ends.",
        belief: "Effect schedules the work by itself and runs it later."
      }
    ]
  },
  keyIdea:
    "A Promise starts its work when you create it. An Effect is only a value that describes work. Creating it does nothing, and you can run it zero, one or many times. Effect.sync wraps a function that has a side effect, and the function runs each time the Effect runs.",
  hints: [
    "Call `sendReceipt(\"a\")` and look at the `sent` array. Did the receipt go out when you only built the Effect?",
    "The body of `sendReceipt` runs at once. Which Effect constructor holds a function and calls it later?",
    "Wrap the `sent.push(id)` call in `Effect.sync(() => ...)` and return that Effect."
  ]
})
