import { defineConcept } from "../../Concept.ts"
import { provideWithALayer } from "../provide-with-a-layer/concept.ts"

export const swapForATest = defineConcept({
  dir: import.meta.dirname,
  id: "swap-for-a-test",
  title: "Swapping a dependency for a test",
  goal: "Test with a fake dependency",
  needs: [provideWithALayer],
  probe: {
    question: "You want a test to run `checkout` with a fake gateway. What do you change?",
    correct: "Nothing in checkout. You provide a different Layer for Gateway.",
    distractors: [
      {
        text: "Add a parameter to checkout and pass the fake.",
        belief: "Swapping a dependency means changing the function signature."
      },
      {
        text: "Mock the module that checkout imports.",
        belief: "A test can only replace a dependency by patching modules."
      }
    ]
  },
  keyIdea:
    "The logic asks for a Gateway and never says which one. The program picks the implementation with a Layer. A test provides a fake layer, such as `Gateway.layerTest`, and the real code runs unchanged with no network call. This is dependency injection: the logic and the wiring stay apart.",
  hints: [
    "`checkout` does not change. What do you give it in the test instead of `Gateway.layer`?",
    "Add a second Layer to the class. Its `charge` must not touch the network.",
    "Add `static readonly layerTest = Layer.succeed(Gateway, { charge: (amount) => Effect.succeed({ id: \"ch_test\", amount }) })`."
  ]
})
