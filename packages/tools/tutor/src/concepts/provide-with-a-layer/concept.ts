import { defineConcept } from "../../Concept.ts"
import { defineAService } from "../define-a-service/concept.ts"

export const provideWithALayer = defineConcept({
  dir: import.meta.dirname,
  id: "provide-with-a-layer",
  title: "Building a service with a Layer",
  needs: [defineAService],
  probe: {
    question:
      "`program` needs a Gateway. `Gateway.layer` is a `Layer<Gateway>`. What is `program.pipe(Effect.provide(Gateway.layer))`?",
    correct: "An Effect with Gateway removed from its Requirements. It is ready to run.",
    distractors: [
      {
        text: "A Promise with the result, because provide runs the program.",
        belief: "Providing a dependency runs the Effect."
      },
      {
        text: "The same Effect. Provide only checks types, and the Gateway is found when the program runs.",
        belief: "Requirements stay in the type until the program runs."
      }
    ]
  },
  keyIdea:
    "A Layer is a recipe that builds a service. Layer.succeed(Gateway, implementation) makes a Layer from a ready value. Layer.effect builds the service with an Effect, so it can need other services or set up resources. Effect.provide(layer) feeds the layer to an Effect and removes the service from its Requirements. Put the layer next to the service as a static `layer` property.",
  hints: [
    "The test needs `Gateway.layer`, and the class has none. What turns an implementation into a Layer?",
    "Add `static readonly layer = Layer.succeed(Gateway, { ... })` inside the class.",
    "The implementation is an object with `charge`. Make `charge` return `Effect.succeed({ id: `ch_${amount}`, amount })`."
  ]
})
