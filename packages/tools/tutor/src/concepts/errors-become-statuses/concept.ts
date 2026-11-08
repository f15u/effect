import { defineConcept } from "../../Concept.ts"
import { implementHandlers } from "../implement-handlers/concept.ts"
import { schemaErrors } from "../schema-errors/concept.ts"

export const errorsBecomeStatuses = defineConcept({
  dir: import.meta.dirname,
  id: "errors-become-statuses",
  title: "Turning a typed error into an HTTP status",
  goal: "Send typed errors as HTTP statuses",
  needs: [implementHandlers, schemaErrors],
  probe: {
    question:
      "A handler fails with `DeclinedError`. The endpoint does not list `DeclinedError` in `error`. What does the compiler say?",
    correct: "It rejects the handler. An error that the contract does not list cannot leave the handler.",
    distractors: [
      {
        text: "Nothing. At runtime the client gets a 500.",
        belief: "An error outside the contract is only a runtime matter."
      },
      {
        text: "Nothing. The compiler adds the error to the contract.",
        belief: "The contract follows the handlers."
      }
    ]
  },
  keyIdea:
    "A failure is part of the contract, as a success is. List the error Schema in the endpoint with `error: DeclinedError`. The class carries its status: `Schema.TaggedError<DeclinedError>()(\"DeclinedError\", { ... }, { httpApiStatus: 402 })`. The handler fails with the error as before, and the server sends the status 402 with the encoded error as JSON. The compiler refuses a handler that fails with an error that the contract does not list.",
  hints: [
    "The compiler rejects `PaymentsHandlers`. What does the `create` endpoint not say about its failures?",
    "Add `error: DeclinedError` to the options of the endpoint. Then decide where the status 402 belongs.",
    "Pass `{ httpApiStatus: 402 }` as the third argument of `Schema.TaggedError`."
  ]
})
