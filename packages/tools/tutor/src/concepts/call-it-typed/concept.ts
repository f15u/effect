import { defineConcept } from "../../Concept.ts"
import { serveIt } from "../serve-it/concept.ts"

export const callItTyped = defineConcept({
  dir: import.meta.dirname,
  id: "call-it-typed",
  title: "Calling the API with a client from the same contract",
  needs: [serveIt],
  probe: {
    question:
      "The client is generated from `Api`. You rename the endpoint `create` to `charge` in the contract. What happens to `client.payments.create(...)`?",
    correct: "It no longer compiles. The client mirrors the contract, so the compiler finds the call.",
    distractors: [
      {
        text: "It compiles, and the server answers 404 at runtime.",
        belief: "The client keeps its own copy of the endpoint names."
      },
      {
        text: "It keeps working, because the old name stays as an alias.",
        belief: "Renames are free, because the contract keeps old names."
      }
    ]
  },
  keyIdea:
    "HttpApiClient.make(Api, { baseUrl }) builds a client from the same contract that the server uses. The calls mirror the contract: `client.payments.create({ payload })` takes the payload type, returns the success type, and fails with the error types of the endpoint, such as DeclinedError. It needs an HttpClient, and FetchHttpClient.layer provides one. A change to the contract is a compile error in every caller.",
  hints: [
    "`pay` returns a fixed receipt and never calls the server. Which `HttpApiClient` function builds a client from `Api`?",
    "Get the client with `yield* HttpApiClient.make(Api, { baseUrl: \"http://localhost:3000\" })`. Provide `FetchHttpClient.layer` so that it can send requests.",
    "Call `client.payments.create({ payload: { amount, token: \"tok\" } })`, and return its result."
  ]
})
