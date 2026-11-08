import { defineConcept } from "../../Concept.ts"
import { swapForATest } from "../swap-for-a-test/concept.ts"

export const layersThatNeedLayers = defineConcept({
  dir: import.meta.dirname,
  id: "layers-that-need-layers",
  title: "Building a layer from other layers",
  goal: "Swap any dependency without touching my logic",
  needs: [swapForATest],
  probe: {
    question:
      "`Gateway.layerNoDeps` is a `Layer<Gateway, never, Http>`. What is the type of `Gateway.layerNoDeps.pipe(Layer.provide(Http.layer))`?",
    correct: "Layer<Gateway>. Http is built inside, and only Gateway comes out.",
    distractors: [
      {
        text: "Layer<Gateway | Http>. Both services come out.",
        belief: "Layer.provide keeps the provided service in the output. Only Layer.provideMerge does that."
      },
      {
        text: "Layer<Gateway, never, Http>. Nothing changes until the program runs.",
        belief: "A layer keeps its requirement until the program runs."
      }
    ]
  },
  keyIdea:
    "A Layer<Out, Error, In> builds Out and needs In. A service often needs other services: the third slot of its layer shows them. Layer.provide(other) feeds other into the layer and removes In from its requirements, and the output stays Out. Layer.provideMerge also keeps the provided service in the output. Layer.mergeAll joins independent layers. At the edge you build one layer with nothing left to need, and a test builds another.",
  hints: [
    "`Gateway.layer` still needs `Http`, so `Effect.runPromise` rejects the program. Which Layer function feeds one layer into another?",
    "Pipe `Gateway.layerNoDeps` into `Layer.provide(Http.layer)`.",
    "Write `static readonly layer = this.layerNoDeps.pipe(Layer.provide(Http.layer))`. Place it after `layerNoDeps`."
  ]
})
