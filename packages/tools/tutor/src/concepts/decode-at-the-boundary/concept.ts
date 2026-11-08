import { defineConcept } from "../../Concept.ts"
import { describeDataOnce } from "../describe-data-once/concept.ts"
import { transformWithPipe } from "../transform-with-pipe/concept.ts"

export const decodeAtTheBoundary = defineConcept({
  dir: import.meta.dirname,
  id: "decode-at-the-boundary",
  title: "Decoding unknown input into a typed Effect",
  needs: [describeDataOnce, transformWithPipe],
  probe: {
    question: "`Schema.decodeUnknownEffect(Payment)(input)` gets a bad input. Where does the failure go?",
    correct: "Into the Error type of the Effect, as a SchemaError. The caller must handle it.",
    distractors: [
      {
        text: "It throws an exception, as decodeUnknownSync does.",
        belief: "Every decode function throws on bad input."
      },
      {
        text: "It becomes a defect, outside the Error type.",
        belief: "Bad input is a bug, and Effect treats it as a defect."
      }
    ]
  },
  keyIdea:
    "Decode at the boundary: the one place where unknown data comes in. Schema.decodeUnknownEffect(schema) takes an unknown value and returns an Effect. If the value fits, the Effect succeeds with the typed value. If not, it fails with a SchemaError, and that error is in the type. After the boundary, the rest of the code works with a type that it can trust.",
  hints: [
    "`readPayment` casts `input` with `as Payment`, so bad input passes. Which Schema function checks an unknown value and returns an Effect?",
    "Call `Schema.decodeUnknownEffect(Payment)` and give it `input`.",
    "Write `Schema.decodeUnknownEffect(Payment)(input)` as the result of `readPayment`."
  ]
})
