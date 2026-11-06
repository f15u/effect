import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Stream from "effect/Stream"
import * as ChildProcess from "effect/process/ChildProcess"
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner"
import { TutorError } from "./TutorError.ts"

export interface ProcessResult {
  readonly stdout: string
  readonly stderr: string
  readonly exitCode: number
}

export class Process extends Context.Service<
  Process,
  {
    readonly execute: (
      command: string,
      args: ReadonlyArray<string>,
      cwd: string,
    ) => Effect.Effect<ProcessResult, TutorError>
  }
>()("tutor/Process", {
  make: Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner

    const execute = Effect.fn("Process.execute")(function* (
      command: string,
      args: ReadonlyArray<string>,
      cwd: string,
    ) {
      const child = ChildProcess.make(command, args, { cwd, stdin: "ignore" })
      return yield* Effect.scoped(
        Effect.gen(function* () {
          const handle = yield* spawner.spawn(child)
          const [stdout, stderr, exitCode] = yield* Effect.all(
            [
              handle.stdout.pipe(Stream.decodeText(), Stream.mkString),
              handle.stderr.pipe(Stream.decodeText(), Stream.mkString),
              handle.exitCode,
            ],
            { concurrency: "unbounded" },
          )
          return { stdout, stderr, exitCode: Number(exitCode) }
        }),
      ).pipe(
        Effect.mapError(
          () =>
            new TutorError({
              reason: "MissingCommand",
              message: `${command} was not found or could not start. Ask the learner to install Node.js with npm, or install effect and typescript themselves, then run the command again.`,
            }),
        ),
      )
    })

    return { execute }
  }),
}) {
  static readonly layer = Layer.effect(this, this.make)
}
