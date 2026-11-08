import { defineConcept } from "../../Concept.ts"
import { apiIsAContract } from "../api-is-a-contract/concept.ts"
import { functionsWithEffectFn } from "../functions-with-effect-fn/concept.ts"

export const implementHandlers = defineConcept({
  dir: import.meta.dirname,
  id: "implement-handlers",
  title: "Implementing the endpoints of a contract",
  needs: [apiIsAContract, functionsWithEffectFn],
  probe: {
    question: "The handler for `create` receives `{ payload }`. What is the type of `payload`?",
    correct: "The decoded PaymentRequest. The Schema checked the body before the handler ran.",
    distractors: [
      {
        text: "unknown. The handler must check the body itself.",
        belief: "Handlers receive raw input and validate it."
      },
      {
        text: "A string of raw JSON that the handler parses.",
        belief: "The framework gives the body as text."
      }
    ]
  },
  keyIdea:
    "HttpApiBuilder.group(Api, \"payments\", build) implements one group. Inside, handlers.handle(\"create\", ({ payload }) => ...) gives the handler for one endpoint. The handler gets values that the Schemas already decoded, and it must return a value that fits the success Schema. The compiler checks that you handle every endpoint of the group and that each reply has the declared type.",
  hints: [
    "The handler returns a fixed receipt. It must read the `payload` that arrives.",
    "Use the argument: `({ payload }) => ...`. The receipt id is `rc_` and the token. The amount is the amount of the payload.",
    "Return `Effect.succeed({ id: `rc_${payload.token}`, amount: payload.amount })`."
  ]
})
