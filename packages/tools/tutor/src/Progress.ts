import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import { TutorError } from "./TutorError.ts"

export const stateFile = ".effect-tutor.json"

export const Phase = Schema.Literals([
  "Menu",
  "Probing",
  "ChoosingMode",
  "Working",
  "Replaying",
  "ProjectWork",
])
export type Phase = typeof Phase.Type

export const Level = Schema.Literals(["Proved", "Explained"])
export type Level = typeof Level.Type

export const State = Schema.Struct({
  phase: Phase,
  goal: Schema.String,
  path: Schema.Array(Schema.String),
  exercise: Schema.String,
  hints: Schema.Number,
  evidence: Schema.Record(Schema.String, Level),
  trusted: Schema.optionalKey(Schema.Boolean),
})
export type State = typeof State.Type

export const emptyState: State = {
  phase: "Menu",
  goal: "",
  path: [],
  exercise: "",
  hints: 0,
  evidence: {},
}

const Json = Schema.fromJsonString(State)

export class Progress extends Context.Service<
  Progress,
  {
    readonly exists: Effect.Effect<boolean>
    readonly read: Effect.Effect<State, TutorError>
    readonly update: (
      f: (state: State) => State,
    ) => Effect.Effect<State, TutorError>
  }
>()("tutor/Progress", {
  make: Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem

    const exists = fs.exists(stateFile).pipe(Effect.orDie)

    const read = Effect.gen(function* () {
      if (!(yield* fs.exists(stateFile))) return emptyState
      return yield* Schema.decodeUnknownEffect(Json)(
        yield* fs.readFileString(stateFile),
      )
    }).pipe(
      Effect.mapError(
        () =>
          new TutorError({
            reason: "BadState",
            message: `${stateFile} cannot be read. Ask the learner to fix or delete it, then run the command again.`,
          }),
      ),
    )

    const update = Effect.fn("Progress.update")(function* (
      f: (state: State) => State,
    ) {
      const next = f(yield* read)
      const text = yield* Schema.encodeEffect(Json)(next).pipe(Effect.orDie)
      yield* fs.writeFileString(stateFile, text).pipe(Effect.orDie)
      return next
    })

    return { exists, read, update }
  }),
}) {
  static readonly layer = Layer.effect(this, this.make)
}
