import { defineConcept } from "../../Concept.ts"
import { thrownErrorsHide } from "../thrown-errors-hide/concept.ts"
import { transformWithPipe } from "../transform-with-pipe/concept.ts"

export const wrapWhatThrows = defineConcept({
  dir: import.meta.dirname,
  id: "wrap-what-throws",
  title: "Turning a rejected Promise into a typed error",
  needs: [thrownErrorsHide, transformWithPipe],
  probe: {
    question:
      "A function returns a Promise that can reject. You wrap it with Effect.promise, and the Promise rejects. What happens?",
    correct: "The rejection becomes a defect, outside the Error type. Effect.tryPromise gives a typed error.",
    distractors: [
      {
        text: "The rejection becomes a typed error in the Error type.",
        belief: "Effect.promise turns every rejection into a typed error."
      },
      {
        text: "Effect ignores the rejection and succeeds with undefined.",
        belief: "Effect hides a rejection."
      }
    ]
  },
  keyIdea:
    "Effect.tryPromise takes a try function and a catch function. The catch function turns the rejection into your tagged error, and that error enters the Error type. Effect.try does the same for a function that throws. Effect.promise treats a rejection as a defect.",
  hints: [
    "Effect.promise cannot fail. Which sibling function accepts a way to build an error?",
    "Use `Effect.tryPromise({ try: ..., catch: ... })`.",
    "In `try`, call `providerAuthorize(token)`. In `catch`, return `new NetworkError()`."
  ]
})
