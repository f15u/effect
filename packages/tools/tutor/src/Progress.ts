import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"

export const stateFile = ".effect-tutor.json"

export const Phase = Schema.Literals(["Menu", "ChoosingMode"])
export type Phase = typeof Phase.Type

export const Level = Schema.Literals(["Proved", "Explained"])
export type Level = typeof Level.Type

export const State = Schema.Struct({
  phase: Phase,
  goal: Schema.String,
  path: Schema.Array(Schema.String),
  evidence: Schema.Record(Schema.String, Level),
})
export type State = typeof State.Type

export const emptyState: State = {
  phase: "Menu",
  goal: "",
  path: [],
  evidence: {},
}

const Json = Schema.fromJsonString(State)

export class Progress extends Context.Service<
  Progress,
  {
    readonly exists: Effect.Effect<boolean>
    readonly read: Effect.Effect<State>
    readonly update: (f: (state: State) => State) => Effect.Effect<State>
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
    }).pipe(Effect.orDie)

    const update = Effect.fn("Progress.update")(function* (
      f: (state: State) => State,
    ) {
      const next = f(yield* read)
      yield* fs.writeFileString(
        stateFile,
        yield* Schema.encodeEffect(Json)(next),
      )
      return next
    }, Effect.orDie)

    return { exists, read, update }
  }),
}) {
  static readonly layer = Layer.effect(this, this.make)
}
