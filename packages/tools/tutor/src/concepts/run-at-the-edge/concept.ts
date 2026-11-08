import { defineConcept } from "../../Concept.ts"
import { effectIsADescription } from "../effect-is-a-description/concept.ts"

export const runAtTheEdge = defineConcept({
  dir: import.meta.dirname,
  id: "run-at-the-edge",
  title: "Running an Effect once, at the edge of the program",
  needs: [effectIsADescription],
  probe: {
    question: "Where in a program do you run an Effect?",
    correct: "Once, at the edge: the entry point or the request handler. Inside the program you only build Effects.",
    distractors: [
      {
        text: "In every function, so that each function gives back a plain value.",
        belief: "Running is how you get a value out, so every function must run its Effects."
      },
      {
        text: "Nowhere. Node runs an Effect when the module loads.",
        belief: "An Effect runs by itself, as an imported Promise does."
      }
    ]
  },
  keyIdea:
    "Build Effects and combine them. Run the result once, at the edge. Effect.runPromise runs an Effect and gives a Promise of its value. In a real program, NodeRuntime.runMain does the same for the main Effect and also handles signals and the exit code.",
  hints: [
    "`program` is a description. Which function turns a description into a Promise?",
    "Look for a function in `Effect` that starts with `run`.",
    "Return `Effect.runPromise(program)` from `main`."
  ]
})
