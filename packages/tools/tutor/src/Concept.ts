import * as Schema from "effect/Schema"

const Probe = Schema.Struct({
  question: Schema.String,
  correct: Schema.String,
  distractors: Schema.Array(
    Schema.Struct({ text: Schema.String, belief: Schema.String })
  )
})

const ConceptData = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  goal: Schema.optionalKey(Schema.String),
  probe: Probe,
  keyIdea: Schema.String,
  hints: Schema.Array(Schema.String)
})

export interface Concept extends Schema.Schema.Type<typeof ConceptData> {
  readonly dir: string
  readonly needs: ReadonlyArray<Concept>
}

export const notSure = "I am not sure."

export const probeOptions = (concept: Concept): ReadonlyArray<string> => [
  concept.probe.correct,
  ...concept.probe.distractors.map((item) => item.text),
  notSure
]

export const defineConcept = (concept: Concept): Concept => {
  const { dir: _dir, needs: _needs, ...data } = concept
  Schema.decodeUnknownSync(ConceptData)(data)
  const options = probeOptions(concept)
  if (new Set(options).size !== options.length) {
    throw new Error(`Concept ${concept.id}: probe options must be unique`)
  }
  return concept
}
