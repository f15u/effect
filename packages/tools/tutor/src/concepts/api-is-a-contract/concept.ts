import { defineConcept } from "../../Concept.ts"
import { describeDataOnce } from "../describe-data-once/concept.ts"
import { transformWithPipe } from "../transform-with-pipe/concept.ts"

export const apiIsAContract = defineConcept({
  dir: import.meta.dirname,
  id: "api-is-a-contract",
  title: "Describing an HTTP API as a contract",
  goal: "Describe an HTTP API as a contract",
  needs: [describeDataOnce, transformWithPipe],
  probe: {
    question:
      "An API definition lists one endpoint, its payload Schema and its success Schema. It has no handler. What is it good for?",
    correct: "It is a contract. The server, a client and the docs all read it, so they cannot disagree.",
    distractors: [
      {
        text: "Nothing yet. It is an unfinished server that fails at startup.",
        belief: "An API definition is part of the server, and it does nothing without handlers."
      },
      {
        text: "It is only documentation. The server ignores it.",
        belief: "The definition is a comment about the API and does not change behavior."
      }
    ]
  },
  keyIdea:
    "Define what the API accepts and returns before you write any code that does the work. HttpApiEndpoint.post(\"create\", \"/payments\", { payload, success }) names the endpoint, its method and path, and the Schema of the request body and of the reply. HttpApiGroup collects endpoints, and HttpApi collects groups. The definition has no server code, so a server, a client and the OpenAPI docs can all use the same file.",
  hints: [
    "`PaymentsGroup` has no endpoints. Which `HttpApiEndpoint` function describes a POST?",
    "Add the endpoint to the group with `.add(HttpApiEndpoint.post(\"create\", \"/payments\", { ... }))`.",
    "The options are `payload: PaymentRequest` and `success: Receipt`."
  ]
})
