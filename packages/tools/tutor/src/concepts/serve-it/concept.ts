import { defineConcept } from "../../Concept.ts"
import { errorsBecomeStatuses } from "../errors-become-statuses/concept.ts"
import { provideWithALayer } from "../provide-with-a-layer/concept.ts"

export const serveIt = defineConcept({
  dir: import.meta.dirname,
  id: "serve-it",
  title: "Serving the API with layers",
  needs: [errorsBecomeStatuses, provideWithALayer],
  probe: {
    question:
      "A client sends `{ \"amount\": \"5\" }` to the server. Your handler has no check for the type. What does the client get?",
    correct: "A 400. The contract decodes the payload before the handler, and a decode failure becomes a 400.",
    distractors: [
      {
        text: "A 200. The handler runs with the string \"5\" as the amount.",
        belief: "The server passes the body to the handler as it is."
      },
      {
        text: "A 500. The handler breaks when it gets the wrong type.",
        belief: "Bad input reaches the handler and crashes it."
      }
    ]
  },
  keyIdea:
    "HttpApiBuilder.layer(Api) builds the routes of the contract. It needs a layer for the handlers of each group: Layer.provide(PaymentsHandlers). HttpRouter.toWebHandler turns the routes into a function from Request to Response, so you can run it in any runtime. To listen on a port, use HttpRouter.serve and Layer.launch with NodeHttpServer.layer. Either way, the contract protects the handler: a payload that does not fit is a 400, and the handler never sees it.",
  hints: [
    "`handler` answers 501 for every request. What turns a contract and its handlers into routes?",
    "Build `HttpApiBuilder.layer(Api)` and feed it the handlers with `Layer.provide(PaymentsHandlers)`.",
    "Pass that layer, with `Layer.provide(HttpServer.layerServices)`, to `HttpRouter.toWebHandler` and export `{ handler, dispose }`."
  ]
})
