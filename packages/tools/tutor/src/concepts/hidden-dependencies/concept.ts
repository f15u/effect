import { defineConcept } from "../../Concept.ts"

export const hiddenDependencies = defineConcept({
  dir: import.meta.dirname,
  id: "hidden-dependencies",
  title: "Seeing why a function that reaches for an import is hard to test",
  needs: [],
  probe: {
    question:
      "`checkout` calls an imported `liveGateway` directly. A test wants a fake gateway so that it makes no network call. What is the problem?",
    correct:
      "The signature of checkout does not show the gateway, so a test cannot replace it without patching the module.",
    distractors: [
      {
        text: "TypeScript refuses to compile a function that uses an import.",
        belief: "A function that uses an imported value is invalid."
      },
      {
        text: "The gateway must be a class, because only a class can be replaced.",
        belief: "Replacing a dependency needs a class and inheritance."
      }
    ]
  },
  keyIdea:
    "A function that reaches for an import has a hidden dependency. Its signature does not say that it needs the gateway, so a test cannot give it another one. A function that takes the gateway as a parameter shows the dependency and accepts any value of that shape. Passing it by hand through every function gets heavy, and the next concepts show how Effect does this for you.",
  hints: [
    "Which line of `checkout` makes a real network call? Can a test change that line without editing `checkout`?",
    "Give `checkout` a second parameter for the gateway, and use that parameter instead of `liveGateway`.",
    "Write `checkout = async (amount: number, gateway: Gateway) => ...` and call `gateway.charge(amount)`."
  ]
})
