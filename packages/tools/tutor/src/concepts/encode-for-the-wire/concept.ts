import { defineConcept } from "../../Concept.ts"
import { decodeAtTheBoundary } from "../decode-at-the-boundary/concept.ts"

export const encodeForTheWire = defineConcept({
  dir: import.meta.dirname,
  id: "encode-for-the-wire",
  title: "Telling the type in memory from the type on the wire",
  needs: [decodeAtTheBoundary],
  probe: {
    question:
      "A Payment has a `createdAt` that is a `Date` in your code. It is a string in the JSON. How does one Schema handle both?",
    correct:
      "The Schema has two sides: the Encoded type on the wire (string) and the Type in memory (Date). Decode goes from the first to the second, and encode goes back.",
    distractors: [
      {
        text: "It cannot. You need one type for the wire and a mapping function by hand.",
        belief: "A Schema describes only one side of the data."
      },
      {
        text: "JSON.stringify turns a Date into a string, so the Schema needs no extra work.",
        belief: "Dates convert to strings for free, and back to Dates as well."
      }
    ]
  },
  keyIdea:
    "A Schema has two types. Type is the value in your program. Encoded is the value on the wire. For most fields they are the same. For a field such as a date they differ, and a codec such as Schema.DateFromString links them: decode turns the string into a Date, and encode turns the Date into a string. Schema.encodeSync does the way out, so what you send is what a decoder accepts.",
  hints: [
    "`createdAt` is `Schema.String`, so the decoded value is a string. Which Schema decodes an ISO string into a `Date`?",
    "Look for a Schema whose name says what it converts: a date from a string.",
    "Use `Schema.DateFromString` for `createdAt`."
  ]
})
