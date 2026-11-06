import * as Cause from "effect/Cause"
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import { Curriculum } from "./Curriculum.ts"
import { allows, youCanNow } from "./Machine.ts"
import { Progress, stateFile, type State } from "./Progress.ts"
import { TutorError } from "./TutorError.ts"

export interface Output {
  readonly text: string
  readonly ok: boolean
}

const bullet = (items: ReadonlyArray<string>) =>
  items.map((item) => `  - ${item}`).join("\n")

const instruction = (state: State) =>
  Effect.gen(function* () {
    switch (state.phase) {
      case "Menu": {
        const curriculum = yield* Curriculum
        const open = curriculum.goals.filter(
          (item) => state.evidence[item.id] === undefined,
        )
        return `Show the learner these goals in plain words. Ask which one they want.\n${bullet(open.map((item) => `${item.id}: ${item.goal}`))}`
      }
      case "ChoosingMode":
        return "Ask the learner: practise with a small exercise, or in their own project?"
    }
  })

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
        lines.push(yield* instruction(after))
    } else {
      const error = Cause.findError(exit.cause)
      if (error._tag === "Success" && error.success instanceof TutorError) {
        lines.push(error.success.message)
        if (error.success.reason === "WrongPhase")
          lines.push(yield* instruction(after))
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
    const curriculum = yield* Curriculum
    yield* curriculum.validateGoals([id])
    const picked = curriculum.concept(id)
    const progress = yield* Progress
    const known = new Set(Object.keys((yield* progress.read).evidence))
    const path = curriculum.path([id], known)
    if (!(yield* progress.exists))
      yield* Console.log(
        `The tutor now writes ${stateFile} in this folder. It keeps the learner's progress so it survives a closed agent.`,
      )
    yield* progress.update((state) => ({
      ...state,
      phase: "ChoosingMode",
      goal: picked.id,
      path: path.map((item) => item.id),
    }))
    return [
      `Goal: ${picked.goal}.`,
      `Path:\n${bullet(path.map((item) => item.title))}`,
    ]
  })
