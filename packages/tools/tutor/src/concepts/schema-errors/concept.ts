import { defineConcept } from "../../Concept.ts"
import { namedErrors } from "../named-errors/concept.ts"
import { refineAndBrand } from "../refine-and-brand/concept.ts"

export const schemaErrors = defineConcept({
  dir: import.meta.dirname,
  id: "schema-errors",
  title: "Sending an error over the wire as a Schema",
  goal: "Never trust data that crosses a boundary",
  needs: [refineAndBrand, namedErrors],
  probe: {
    question:
      "A Data.TaggedError goes into a JSON response. A client reads the JSON. What does the client know about the error?",
    correct: "Nothing reliable. The error has no Schema, so its shape on the wire is not defined or checked.",
    distractors: [
      {
        text: "Everything. The _tag and the fields travel as JSON, and the client rebuilds the error.",
        belief: "Any tagged error is serialized and rebuilt by itself."
      },
      {
        text: "Only the message, because JSON.stringify keeps just the message of an Error.",
        belief: "Errors always lose every field except the message."
      }
    ]
  },
  keyIdea:
    "A class that extends Schema.TaggedError is an error and a Schema in one. `Schema.TaggedError<Self>()(\"Tag\", { field: Schema.String })` defines the fields, and you still use it as before: `yield*` it, or handle it with Effect.catchTag. Because it is a Schema, you can encode it to JSON and decode a client's copy back into a real instance. Both sides then agree on the shape of a failure, as they do for a success.",
  hints: [
    "`DeclinedError` extends `Data.TaggedError`, and that class has no Schema. Which Schema constructor makes an error class?",
    "Replace the base with `Schema.TaggedError<DeclinedError>()(\"DeclinedError\", { ... })`. Move the fields into the object.",
    "Write `class DeclinedError extends Schema.TaggedError<DeclinedError>()(\"DeclinedError\", { reason: Schema.String }) {}`."
  ]
})
