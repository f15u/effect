import { defineConcept } from "../../Concept.ts"
import { callItTyped } from "../call-it-typed/concept.ts"
import { handleAllErrors } from "../handle-all-errors/concept.ts"
import { layersThatNeedLayers } from "../layers-that-need-layers/concept.ts"
import { schemaErrors } from "../schema-errors/concept.ts"

export const serveAWorkingApi = defineConcept({
  dir: import.meta.dirname,
  id: "serve-a-working-api",
  title: "Building the payments API from its parts",
  goal: "Serve a working HTTP API",
  needs: [callItTyped, schemaErrors, layersThatNeedLayers, handleAllErrors],
  probe: {
    question:
      "The payments API has a contract, handlers that use a Gateway service, and a server. Where do you choose the real Gateway or a fake one?",
    correct: "In the server layer, where you provide the Gateway. The contract and the handlers stay the same.",
    distractors: [
      {
        text: "In the handler, with a flag that picks the gateway.",
        belief: "A handler must know which implementation it uses."
      },
      {
        text: "In the contract, as the contract names the implementation.",
        belief: "The contract chooses how the server works."
      }
    ]
  },
  keyIdea:
    "Each part has one job. The contract says what goes over the wire: payload, receipt and errors, as Schemas. The handlers do the work, ask for services such as Gateway, and fail with typed errors. The server joins the parts with layers, and it is the only place that picks real or fake services. Schema checks every request, so a bad payload never reaches a handler, and a typed error reaches the client as a status and a body.",
  hints: [
    "Start with the contract: a group with one `create` endpoint. The payload, the success and the error are already in the file.",
    "Then the handlers. Get the `Gateway` with `yield* Gateway` once, at the top of the group function, before `handlers.handle`. The handler returns `gateway.charge(payload.amount)`. Then the server: give `Gateway.layer` to the handlers, give the handlers to the routes, and export the web handler.",
    "Contract: `HttpApiEndpoint.post(\"create\", \"/payments\", { payload: PaymentRequest, success: Receipt, error: DeclinedError })`. Server: `HttpApiBuilder.layer(Api).pipe(Layer.provide(PaymentsHandlers.pipe(Layer.provide(Gateway.layer))))`."
  ]
})
