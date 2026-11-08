import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as FileSystem from "effect/FileSystem"
import * as Option from "effect/Option"
import * as Path from "effect/Path"
import * as Random from "effect/Random"
import * as Schema from "effect/Schema"
import { Checker, renderCheck } from "./Checker.ts"
import { materialize } from "./Exercise.ts"
import { notSure, probeOptions, type Concept } from "./Concept.ts"
import { Curriculum } from "./Curriculum.ts"
import { holdsLine } from "./ProjectFile.ts"
import { allows, youCanNow, type Surface } from "./Machine.ts"
import { Progress, stateFile, type Level, type State } from "./Progress.ts"
import { TutorError } from "./TutorError.ts"

export interface Output {
  readonly text: string
  readonly ok: boolean
}

const bullet = (items: ReadonlyArray<string>) =>
  items.map((item) => `  - ${item}`).join("\n")

const readState = Effect.flatMap(Progress, (progress) => progress.read)

const conceptOf = (state: State) =>
  Effect.map(Curriculum, (curriculum) => curriculum.concept(state.path[0]!))

const instruction = (state: State) =>
  Effect.gen(function* () {
    switch (state.phase) {
      case "Menu": {
        const curriculum = yield* Curriculum
        const open = curriculum.goals.filter(
          (item) => state.evidence[item.id] === undefined,
        )
        if (open.length === 0)
          return "No goal is left. Every goal is done. Say so in one line."
        return `Show the learner these goals in plain words. Ask which one they want.\n${bullet(open.map((item) => `${item.id}: ${item.goal}`))}`
      }
      case "Probing":
        return "Tell the learner a question will appear for them in a picker. Call the probe tool. Never describe the options."
      case "ChoosingMode":
        return "Ask the learner: practise with a small exercise, or in their own project?"
      case "Replaying": {
        const concept = yield* conceptOf(state)
        return `Tell the learner plainly that "${concept.title}" is complete and nothing is missing. Then ask, as an optional question, the same question again (would they answer differently now?):\n  "${concept.probe.question}"\nThe learner may answer or skip. Never block on it.`
      }
      case "Working": {
        const concept = yield* conceptOf(state)
        return `The learner edits ${state.exercise}/main.ts. Teach "${concept.title}" by asking questions. Key idea (do not recite it): ${concept.keyIdea}\nHints used: ${state.hints}/${concept.hints.length}.`
      }
      case "ProjectWork": {
        const concept = yield* conceptOf(state)
        return `Ask the learner to tag the files or folders in their own project where "${concept.title}" applies. Read them with your own tools. Ask where the idea shows in their code, in a plain chat message: the learner types the answer, so use no choice tool. Key idea (do not recite it): ${concept.keyIdea}\nTo record it, pick one line of their code and confirm it with the file path and the exact line.`
      }
    }
  })

export const execute = <E, R>(
  name: string,
  handler: Effect.Effect<ReadonlyArray<string>, E | TutorError, R>,
  surface: Surface = "shell",
) =>
  Effect.gen(function* () {
    const before = yield* readState
    const exit = yield* Effect.exit(
      allows(before.phase, name)
        ? handler
        : Effect.fail(
            new TutorError({ reason: "WrongPhase", message: "Not now." }),
          ),
    )
    const after = yield* readState
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
    lines.push(youCanNow(after.phase, surface))
    return {
      text: lines.join("\n"),
      ok: Exit.isSuccess(exit),
    } satisfies Output
  }).pipe(
    Effect.catchTag("TutorError", (error) =>
      Effect.succeed({ text: error.message, ok: false } satisfies Output),
    ),
  )

export const status = Effect.succeed<ReadonlyArray<string>>([])

export const nothingForNow = "Nothing for now."

export const goalPrompt = Effect.gen(function* () {
  const curriculum = yield* Curriculum
  const state = yield* readState
  return curriculum.goals
    .filter((item) => state.evidence[item.id] === undefined)
    .map((item) => ({ id: item.id, label: item.goal! }))
})

export const stateNotice = `The tutor writes ${stateFile} in this folder. It keeps the learner's progress so it survives a closed agent.`

export const goal = (
  id: string,
  options: {
    readonly trusted?: boolean
    readonly write?: boolean
    readonly surface?: Surface
  } = {},
) =>
  Effect.gen(function* () {
    const { trusted = false, write = false, surface = "shell" } = options
    const curriculum = yield* Curriculum
    yield* curriculum.validateGoals([id])
    const picked = curriculum.concept(id)
    const progress = yield* Progress
    const fresh = !(yield* progress.exists)
    if (fresh && !write)
      return [
        stateNotice,
        `Nothing is written yet. Tell the learner the file name and why. Then repeat: ${surface === "mcp" ? `call tutor_goal with goals ["${id}"] and write true` : `run: tutor goal ${id} --write`}.`,
      ]
    const known = new Set(Object.keys((yield* readState).evidence))
    const path = curriculum.path([id], known)
    yield* progress.update((state) => ({
      ...state,
      phase: trusted ? "Probing" : "ChoosingMode",
      goal: picked.id,
      path: path.map((item) => item.id),
      trusted,
    }))
    return [
      ...(fresh ? [`The tutor wrote ${stateFile} to keep the progress.`] : []),
      `Goal: ${picked.goal}.`,
      `Path:\n${bullet(path.map((item) => item.title))}`,
    ]
  })

export const skipProbe = Effect.gen(function* () {
  yield* (yield* Progress).update((current) => ({
    ...current,
    phase: "ChoosingMode",
    trusted: false,
  }))
  return [
    "This client cannot show the learner a question, so the question is skipped.",
  ]
})

export const Mode = Schema.Literals(["exercise", "project"])
export type Mode = typeof Mode.Type

export const Replay = Schema.Literals(["answered", "skipped"])
export type Replay = typeof Replay.Type

export const mode = (
  choice: Mode,
  folder: Option.Option<string>,
  install: boolean,
  surface: Surface = "shell",
) =>
  Effect.gen(function* () {
    if (choice === "project") {
      yield* (yield* Progress).update((current) => ({
        ...current,
        phase: "ProjectWork",
      }))
      return []
    }
    if (Option.isNone(folder))
      return [
        "No file is written yet. Ask the learner for the exercise folder name. Suggest none.",
        "Say what the tool will write: the starter file, and a package.json and tsconfig.json so the editor shows types.",
        surface === "mcp"
          ? "Ask if the tool may install effect and typescript. Then call tutor_mode with mode exercise, the folder, and install true after a yes."
          : "Ask if the tool may install effect and typescript. Then run: tutor mode exercise <folder> [--install]",
      ]
    if (/^\/|(^|\/)\.\.(\/|$)/.test(folder.value))
      return yield* new TutorError({
        reason: "BadFolder",
        message: `Folder ${folder.value} must be a relative path inside this folder. Ask the learner for another name.`,
      })
    const { concept } = yield* working
    const lines = yield* materialize(folder.value, concept, install, surface)
    yield* (yield* Progress).update((current) => ({
      ...current,
      phase: "Working",
      exercise: folder.value,
      hints: 0,
    }))
    return lines
  })

const working = Effect.gen(function* () {
  const state = yield* readState
  return { state, concept: yield* conceptOf(state) }
})

const raise = (
  evidence: State["evidence"],
  id: string,
  level: Level,
): State["evidence"] => ({
  ...evidence,
  [id]: evidence[id] === "Proved" ? "Proved" : level,
})

const completed = (id: string, level: Level) =>
  Effect.gen(function* () {
    const progress = yield* Progress
    const last = (yield* readState).path.length === 1
    yield* progress.update((current) => ({
      ...current,
      phase: last ? "Menu" : "Replaying",
      path: last ? [] : current.path,
      goal: last ? "" : current.goal,
      exercise: "",
      hints: 0,
      evidence: raise(current.evidence, id, level),
    }))
    return last
      ? ["The goal is reached. Say so in one line. Ask for no confirmation."]
      : []
  })

const explainedNeed = (
  concept: Concept,
  evidence: State["evidence"],
): Concept | undefined => {
  const seen = new Set<string>()
  let layer = concept.needs
  while (layer.length > 0) {
    const hit = layer.find((item) => evidence[item.id] === "Explained")
    if (hit !== undefined) return hit
    layer = layer
      .flatMap((item) => item.needs)
      .filter((item) => !seen.has(item.id) && seen.add(item.id))
  }
  return undefined
}

export const check = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const curriculum = yield* Curriculum
  const { state, concept } = yield* working
  const file = path.join(state.exercise, "main.ts")
  const source = yield* fs.readFileString(file).pipe(
    Effect.mapError(
      () =>
        new TutorError({
          reason: "MissingFile",
          message: `Cannot read ${file}. Ask the learner to put the exercise file back, or restore the starter file.`,
        }),
    ),
  )
  const result = yield* (yield* Checker).run(
    yield* curriculum.file(concept, "goal.test.ts"),
    source,
  )
  const lines = renderCheck(result)
  if (result._tag !== "Passed") {
    const edited = source !== (yield* curriculum.file(concept, "starter.ts"))
    const need = edited ? explainedNeed(concept, state.evidence) : undefined
    if (need !== undefined) {
      yield* (yield* Progress).update((current) => ({
        ...current,
        phase: "ChoosingMode",
        path: [need.id, ...current.path],
        exercise: "",
        hints: 0,
      }))
      return yield* new TutorError({
        reason: "NotYet",
        message: [
          ...lines,
          `REVISIT: the learner only explained "${need.title}", never proved it. Go back to it first.`,
        ].join("\n"),
      })
    }
    return yield* new TutorError({
      reason: "NotYet",
      message: lines.join("\n"),
    })
  }
  return [...lines, ...(yield* completed(concept.id, "Proved"))]
})
export const replay = (_how: Replay) =>
  Effect.gen(function* () {
    yield* (yield* Progress).update((current) => ({
      ...current,
      phase: current.trusted ? "Probing" : "ChoosingMode",
      path: current.path.slice(1),
    }))
    return []
  })

export const hint = Effect.gen(function* () {
  const { state, concept } = yield* working
  const next = concept.hints[state.hints]
  if (next === undefined)
    return ["No more hints. The solution is now unlocked."]
  yield* (yield* Progress).update((current) => ({
    ...current,
    hints: current.hints + 1,
  }))
  return [
    `HINT ${state.hints + 1}/${concept.hints.length}: ${next}`,
    "Give this hint in your own words. Do not add more.",
  ]
})

export const solution = (said: string) =>
  Effect.gen(function* () {
    const { state, concept } = yield* working
    if (said.trim() === "" && state.hints < concept.hints.length)
      return yield* new TutorError({
        reason: "SolutionLocked",
        message: `LOCKED. The learner used ${state.hints} of ${concept.hints.length} hints. Do not reveal the solution. Give a hint, or ask a guiding question. Only if the learner asks for the solution in their own words, pass those words with --said.`,
      })
    const curriculum = yield* Curriculum
    return [
      `SOLUTION for ${concept.id}:`,
      "",
      yield* curriculum.file(concept, "solution.ts"),
      "The learner must type it into their file themselves.",
    ]
  })

export const confirm = <R = never>(
  file: string,
  quote: string,
  ask: Option.Option<Effect.Effect<boolean, never, R>> = Option.none(),
) =>
  Effect.gen(function* () {
    yield* holdsLine(file, quote)
    if (Option.isNone(ask))
      return [
        "The file holds that line. This client cannot ask the learner, so nothing is recorded. Go on teaching in chat.",
      ]
    if (!(yield* ask.value))
      return [
        "The learner said this is not their code. Nothing is recorded. Ask which file is theirs.",
      ]
    const { concept } = yield* working
    return [
      "The learner confirmed this is their code.",
      ...(yield* completed(concept.id, "Explained")),
    ]
  })

export const reset = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const curriculum = yield* Curriculum
  const { state, concept } = yield* working
  const file = path.join(state.exercise, "main.ts")
  yield* fs
    .writeFileString(file, yield* curriculum.file(concept, "starter.ts"))
    .pipe(
      Effect.mapError(
        () =>
          new TutorError({
            reason: "MissingFile",
            message: `Cannot write ${file}.`,
          }),
      ),
    )
  yield* (yield* Progress).update((current) => ({ ...current, hints: 0 }))
  return [`Reset ${file} to the starter. The hints start again.`]
})

export type ProbeReply =
  | { readonly _tag: "Picked"; readonly label: string; readonly words: string }
  | { readonly _tag: "Declined"; readonly words: string }

export const probePrompt = Effect.gen(function* () {
  const { concept } = yield* working
  const options = yield* Random.shuffle(
    probeOptions(concept).filter((option) => option !== notSure),
  )
  return {
    message: `${concept.probe.question}\n(Open the list below and choose one.)`,
    options: [...options, notSure],
  }
})

export const probe = (reply: ProbeReply) =>
  Effect.gen(function* () {
    const { state, concept } = yield* working
    const progress = yield* Progress
    const words = reply.words.trim()
    const said = words === "" ? [] : [`The learner also wrote: "${words}"`]
    const intoConcept = progress.update((current) => ({
      ...current,
      phase: "ChoosingMode",
    }))
    if (reply._tag === "Declined") {
      yield* intoConcept
      return ["The learner declined the question.", ...said]
    }
    if (reply.label === concept.probe.correct) {
      const rest = state.path.slice(1)
      yield* progress.update((current) => ({
        ...current,
        phase: rest.length === 0 ? "Menu" : "Probing",
        path: rest,
        goal: rest.length === 0 ? "" : current.goal,
        evidence: raise(current.evidence, concept.id, "Explained"),
      }))
      return ["The learner picked the key idea.", ...said]
    }
    yield* intoConcept
    const wrong = concept.probe.distractors.find(
      (item) => item.text === reply.label,
    )
    return [
      wrong === undefined
        ? "The learner is not sure."
        : `The learner picked a wrong idea. Their belief: "${wrong.belief}". Teach against it.`,
      ...said,
    ]
  })
