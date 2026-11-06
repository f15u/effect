import { defineConcept } from "../../Concept.ts"

export const taggedErrors = defineConcept({
  dir: import.meta.dirname,
  id: "tagged-errors",
  title: "Errors that TypeScript can tell apart",
  goal: "See every way my code can fail",
  needs: [],
  probe: {
    question:
      "A function can fail three ways: the card is expired, the token is invalid, or the network is down. In plain TypeScript, what does the function's type tell a caller about these failures?",
    correct:
      "Nothing: a caught error is unknown, so a caller cannot see which failures exist.",
    distractors: [
      {
        text: "It lists the three errors, because each error class has its own name.",
        belief: "Three classes that extend Error are three different types.",
      },
      {
        text: "TypeScript warns the caller when a new kind of error is added.",
        belief: "A try/catch tells the caller which errors can happen.",
      },
    ],
  },
  keyIdea:
    'A thrown error is invisible in the type: the catch variable is unknown. To put errors in the type, each error needs a unique tag, so TypeScript can tell the members of a union apart. Data.TaggedError("Name") gives each class a _tag.',
  wrongBeliefs: [
    "Three classes that extend Error are three different types. (They have the same shape, so TypeScript treats them as one.)",
    "A try/catch tells the caller which errors can happen. (The catch variable is unknown.)",
  ],
  hints: [
    "Compare what the three classes extend. What does Data.TaggedError add that Error does not?",
    'Import Data from "effect". Replace `extends Error` with `extends Data.TaggedError("<tag>")`. The call takes the tag as a string.',
    'The tag equals the class name, for example `class NetworkError extends Data.TaggedError("NetworkError") {}`. Do the same for the other two classes.',
  ],
})
