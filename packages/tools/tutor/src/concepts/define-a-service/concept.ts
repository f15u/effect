import { defineConcept } from "../../Concept.ts"
import { dependenciesInTheType } from "../dependencies-in-the-type/concept.ts"

export const defineAService = defineConcept({
  dir: import.meta.dirname,
  id: "define-a-service",
  title: "Defining a service with Context.Service",
  needs: [dependenciesInTheType],
  probe: {
    question: "What does the string in `Context.Service<Gateway, { ... }>()(\"app/Gateway\")` do?",
    correct: "It is the unique key of the service. Effect uses it to find the implementation that you provide.",
    distractors: [
      {
        text: "It is the file path that Effect imports the implementation from.",
        belief: "A service is found by importing a module."
      },
      {
        text: "It is only a label for logs, and Effect ignores it.",
        belief: "The identifier has no effect on how services are matched."
      }
    ]
  },
  keyIdea:
    "A class that extends Context.Service defines a service. The first type parameter is the class itself. The second is the shape of the service: its methods. The string is a unique key. The class is both a type and a value: `yield* Gateway` gets the service in an Effect, and the type appears in Requirements. A service has no implementation yet. You provide one when you run.",
  hints: [
    "`Gateway` is an interface, and you use it as a value in the test. Which Effect type is both a type and a value?",
    "Write `class Gateway extends Context.Service<Gateway, { ... }>()(\"app/Gateway\") {}`.",
    "Move the members of the interface into the second type parameter. The key can be `\"app/Gateway\"`."
  ]
})
