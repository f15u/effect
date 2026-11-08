import { defineConcept } from "../../Concept.ts"
import { hiddenDependencies } from "../hidden-dependencies/concept.ts"
import { transformWithPipe } from "../transform-with-pipe/concept.ts"

export const dependenciesInTheType = defineConcept({
  dir: import.meta.dirname,
  id: "dependencies-in-the-type",
  title: "Showing what an Effect needs in its type",
  needs: [transformWithPipe, hiddenDependencies],
  probe: {
    question: "`checkout` runs `const gateway = yield* Gateway` in its body. What is its Requirements type?",
    correct: "Gateway. The type says that checkout needs a Gateway before it can run.",
    distractors: [
      {
        text: "never, because the gateway is a global value.",
        belief: "A service is an ambient global that needs no entry in the type."
      },
      {
        text: "unknown, because TypeScript cannot follow a yield* in a body.",
        belief: "The body of a function does not change its type."
      }
    ]
  },
  keyIdea:
    "The third type parameter of Effect is Requirements. `yield* Gateway` asks the environment for the Gateway service, and Effect adds Gateway to the Requirements of the function. A caller that uses it inherits the requirement. Effect.runPromise accepts only an Effect with Requirements never, so the compiler stops you from running code that lacks a dependency.",
  hints: [
    "`checkout` returns a fixed value and uses no gateway. How does an Effect get the Gateway service inside a generator?",
    "Write `const gateway = yield* Gateway`, as you would `yield*` an Effect.",
    "Define `checkout` with `Effect.fn`. Get the gateway, then `yield* gateway.charge(amount)` and return `paid ${charge.id}`."
  ]
})
