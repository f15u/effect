import { defineConcept } from "../../Concept.ts"
import { typedFailure } from "../typed-failure/concept.ts"

export const catchATag = defineConcept({
  dir: import.meta.dirname,
  id: "catch-a-tag",
  title: "Answering one kind of failure",
  needs: [typedFailure],
  probe: {
    question:
      "processPayment can fail with three errors. You handle only ExpiredCardError. What does the type of the new Effect say?",
    correct:
      "Only InvalidTokenError and NetworkError are left. The handled error is gone from the type.",
    distractors: [
      {
        text: "All three errors are still listed, because a handler cannot change a type.",
        belief: "A handler leaves the error type as it was.",
      },
      {
        text: "No errors are listed, because handling one error handles all of them.",
        belief: "Handling one error handles every error.",
      },
    ],
  },
  keyIdea:
    "Effect.catchTag takes an error's _tag and a function that returns an Effect. The handled error leaves the Error type. Unhandled errors stay, and TypeScript rejects a tag that is not in the union.",
  wrongBeliefs: [
    "A handler leaves the error type as it was. (catchTag removes the handled error.)",
    "Handling one error handles every error. (Only the tag you name is handled.)",
  ],
  hints: [
    "You must name one error by its tag. Which Effect function takes a tag?",
    'Pipe `self` into `Effect.catchTag("ExpiredCardError", handler)`. The handler returns an Effect.',
    'Return `Effect.succeed(new Response("Card expired", { status: 402 }))` from the handler.',
  ],
})
