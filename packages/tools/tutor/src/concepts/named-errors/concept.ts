import { defineConcept } from "../../Concept.ts"
import { wrapWhatThrows } from "../wrap-what-throws/concept.ts"

export const namedErrors = defineConcept({
  dir: import.meta.dirname,
  id: "named-errors",
  title: "Giving each error a name and its data",
  needs: [wrapWhatThrows],
  probe: {
    question:
      "Two error classes are empty: `class A extends Error {}` and `class B extends Error {}`. What does TypeScript see?",
    correct:
      "The same shape. TypeScript cannot tell A from B, so no code can pick a handler by type.",
    distractors: [
      {
        text: "Two different types, because the class names differ.",
        belief: "TypeScript tells classes apart by their names.",
      },
      {
        text: "One union that a handler can split by reading the class name.",
        belief: "A handler can read the class name to tell errors apart.",
      },
    ],
  },
  keyIdea:
    'Data.TaggedError gives each error a unique _tag. TypeScript tells errors apart by the tag, and later handlers select an error by the tag. A type argument adds data, for example `Data.TaggedError("ExpiredCardError")<{ readonly last4: string }>`.',
  hints: [
    "What does an error class need so that TypeScript sees two classes as different?",
    'Change each class to extend `Data.TaggedError("ClassName")`. `Data` is already imported.',
    'Give `ExpiredCardError` a field: `Data.TaggedError("ExpiredCardError")<{ readonly last4: string }>`. Then create it with `new ExpiredCardError({ last4: "4242" })`.',
  ],
})
