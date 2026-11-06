import * as Cause from "effect/Cause"
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import { goals } from "./Goals.ts"
import { allows, youCanNow } from "./Machine.ts"
import { Progress, stateFile, type State } from "./Progress.ts"
import { TutorError } from "./TutorError.ts"

export interface Output {
  readonly text: string
  readonly ok: boolean
}

const bullet = (items: ReadonlyArray<string>) =>
  items.map((item) => `  - ${item}`).join("\n")

const instruction = (state: State): string => {
  switch (state.phase) {
    case "Menu":
      return `Show the learner these goals in plain words. Ask which one they want.\n${bullet(goals.map((goal) => `${goal.id}: ${goal.title}`))}`
    case "ChoosingMode":
      return "Ask the learner: practise with a small exercise, or in their own project?"
  }
}

export const execute = <E, R>(
  name: string,
  handler: Effect.Effect<ReadonlyArray<string>, E | TutorError, R>,
) =>
  Effect.gen(function* () {
    const progress = yield* Progress
    const before = yield* progress.read
    const exit = yield* Effect.exit(
      allows(before.phase, name)
        ? handler
        : Effect.fail(
            new TutorError({ reason: "WrongPhase", message: "Not now." }),
          ),
    )
    const after = yield* progress.read
    const lines: Array<string> = []
    if (Exit.isSuccess(exit)) {
      lines.push(...exit.value)
      if (after.phase !== before.phase || name === "status")
        lines.push(instruction(after))
    } else {
      const error = Cause.findError(exit.cause)
      if (error._tag === "Success" && error.success instanceof TutorError) {
        lines.push(error.success.message)
        if (error.success.reason === "WrongPhase")
          lines.push(instruction(after))
      } else {
        lines.push(Cause.pretty(exit.cause))
      }
    }
    lines.push(youCanNow(after.phase))
    return { text: lines.join("\n"), ok: Exit.isSuccess(exit) } satisfies Output
  }).pipe(Effect.orDie)

export const status = Effect.succeed<ReadonlyArray<string>>([])

export const goal = (id: string) =>
  Effect.gen(function* () {
    const picked = goals.find((item) => item.id === id)
    if (picked === undefined)
      return yield* new TutorError({
        reason: "UnknownGoal",
        message: `Unknown goal "${id}". Use one of: ${goals.map((item) => item.id).join(", ")}.`,
      })
    const progress = yield* Progress
    if (!(yield* progress.exists))
      yield* Console.log(
        `The tutor now writes ${stateFile} in this folder. It keeps the learner's progress so it survives a closed agent.`,
      )
    yield* progress.update((state) => ({
      ...state,
      phase: "ChoosingMode",
      goal: picked.id,
    }))
    return [`Goal: ${picked.title}.`]
  })
