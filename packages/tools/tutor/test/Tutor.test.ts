import { assert, describe, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { allows, commandNames, machine } from "../src/Machine.ts"
import { Phase } from "../src/Progress.ts"
import { defineConcept, type Concept } from "../src/Concept.ts"
import {
  session as openSession,
  type Content,
  type Session,
  type WorldOptions,
} from "./Harness.ts"

const concept = (
  id: string,
  options: { goal?: string; needs?: ReadonlyArray<Concept> } = {},
) =>
  defineConcept({
    dir: `/content/${id}`,
    id,
    title: `Title of ${id}`,
    ...(options.goal === undefined ? {} : { goal: options.goal }),
    needs: options.needs ?? [],
    probe: {
      question: `Question of ${id}?`,
      correct: `Correct answer of ${id}`,
      distractors: [
        { text: `Wrong answer one of ${id}`, belief: `Belief one of ${id}` },
        { text: `Wrong answer two of ${id}`, belief: `Belief two of ${id}` },
      ],
    },
    keyIdea: `Key idea of ${id}`,
    hints: [
      `First hint of ${id}`,
      `Second hint of ${id}`,
      `Third hint of ${id}`,
    ],
  })

const solo = concept("solo", { goal: "Goal of solo" })
const base = concept("base")
const middle = concept("middle", { needs: [base] })
const top = concept("top", { goal: "Goal of top", needs: [middle] })
const stubConcepts = [solo, base, middle, top]

const starterOf = (id: string) => `// starter ${id}\n`
const solutionOf = (id: string) => `// SOLVED ${id}\n`

const content: Content = {
  concepts: stubConcepts,
  files: Object.fromEntries(
    stubConcepts.flatMap((item) => [
      [`${item.dir}/starter.ts`, starterOf(item.id)],
      [`${item.dir}/solution.ts`, solutionOf(item.id)],
      [`${item.dir}/goal.test.ts`, ""],
    ]),
  ),
  passes: (source) => source.includes("SOLVED"),
}

const session = (options: Pick<WorldOptions, "install"> = {}) =>
  openSession({ ...content, ...options })

const goalConcepts = stubConcepts.filter((item) => item.goal !== undefined)

const starter = starterOf("solo")

const live = <A, E>(name: string, body: Effect.Effect<A, E>) =>
  it.effect(name, () => body)

describe("status in an empty folder", () => {
  live(
    "shows the goals and what to do next, and writes no file",
    Effect.gen(function* () {
      const s = yield* session()
      const r = yield* s.t("status")
      assert.strictEqual(r.code, 0)
      assert.include(r.out, "Goal of solo")
      assert.include(r.out, "You can now:")
      assert.include(r.out, "tutor goal")
      assert.deepStrictEqual(yield* s.files, [])
    }),
  )
})

describe("the first write", () => {
  live(
    "the first goal call names the state file and why, and writes nothing",
    Effect.gen(function* () {
      const s = yield* session()
      const r = yield* s.t("goal", "solo")
      assert.strictEqual(r.code, 0)
      assert.include(r.out, ".effect-tutor.json")
      assert.match(r.out, /progress/)
      assert.include(r.out, "--write")
      assert.deepStrictEqual(yield* s.files, [])
      const status = yield* s.t("status")
      assert.include(status.out, "tutor goal")
    }),
  )

  live(
    "the repeat with the write flag writes the file",
    Effect.gen(function* () {
      const s = yield* session()
      yield* s.t("goal", "solo")
      const r = yield* s.t("goal", "solo", "--write")
      assert.strictEqual(r.code, 0)
      assert.deepStrictEqual(yield* s.files, [".effect-tutor.json"])
      const again = yield* s.t("status")
      assert.include(again.out, "exercise")
    }),
  )

  live(
    "the notice comes once, not on later writes",
    Effect.gen(function* () {
      const s = yield* session()
      yield* s.t("goal", "solo", "--write")
      const second = yield* s.t("status")
      assert.notInclude(second.out, "now writes")
    }),
  )
})

describe("a goal and its path", () => {
  live(
    "a goal built on another concept gives the path in order",
    Effect.gen(function* () {
      const s = yield* session()
      const r = yield* s.t("goal", "top", "--write")
      assert.strictEqual(r.code, 0)
      const first = r.out.indexOf("Title of base")
      const second = r.out.indexOf("Title of top")
      assert.isTrue(first >= 0 && second > first, r.out)
    }),
  )
})

describe("evidence and the path", () => {
  live(
    "a concept with evidence is left out of the path",
    Effect.gen(function* () {
      const s = yield* session()
      yield* s.write(
        ".effect-tutor.json",
        JSON.stringify({
          phase: "Menu",
          goal: "",
          path: [],
          exercise: "",
          hints: 0,
          evidence: { base: "Proved" },
        }),
      )
      const r = yield* s.t("goal", "top", "--write")
      assert.strictEqual(r.code, 0)
      assert.include(r.out, "Title of top")
      assert.notInclude(r.out, "Title of base")
    }),
  )
})

describe("the menu", () => {
  live(
    "lists goals in plain words and hides a finished goal",
    Effect.gen(function* () {
      const s = yield* session()
      const fresh = yield* s.t("status")
      assert.include(fresh.out, "Goal of top")
      yield* s.write(
        ".effect-tutor.json",
        JSON.stringify({
          phase: "Menu",
          goal: "",
          path: [],
          exercise: "",
          hints: 0,
          evidence: { top: "Explained" },
        }),
      )
      const after = yield* s.t("status")
      assert.include(after.out, "Goal of solo")
      assert.notInclude(after.out, "Goal of top")
    }),
  )
})

describe("refusals", () => {
  live(
    "every command a phase does not list is refused with what to do",
    Effect.gen(function* () {
      const s = yield* session()
      const refused = yield* s.t("mode", "exercise")
      assert.strictEqual(refused.code, 1)
      assert.include(refused.out, "Not now.")
      assert.include(refused.out, "tutor goal")
      yield* s.t("goal", "solo", "--write")
      const again = yield* s.t("goal", "top", "--write")
      assert.strictEqual(again.code, 1)
      assert.include(again.out, "Not now.")
      assert.include(again.out, "tutor mode exercise")
    }),
  )

  live(
    "an unknown goal is refused and writes nothing",
    Effect.gen(function* () {
      const s = yield* session()
      const r = yield* s.t("goal", "nope")
      assert.strictEqual(r.code, 1)
      assert.include(r.out, "Unknown goal")
      assert.deepStrictEqual(yield* s.files, [])
    }),
  )
})

describe("the transition table", () => {
  const reach: Record<Phase, (s: Session) => Effect.Effect<unknown>> = {
    Menu: () => Effect.void,
    Probing: (s) =>
      s.write(
        ".effect-tutor.json",
        JSON.stringify({
          phase: "Probing",
          goal: "solo",
          path: ["solo"],
          exercise: "",
          hints: 0,
          evidence: {},
          trusted: true,
        }),
      ),
    ChoosingMode: (s) => s.t("goal", "solo", "--write"),
    Working: (s) =>
      s
        .t("goal", "solo", "--write")
        .pipe(Effect.andThen(s.t("mode", "exercise", "practice"))),
    Replaying: (s) =>
      s.write(
        ".effect-tutor.json",
        JSON.stringify({
          phase: "Replaying",
          goal: "top",
          path: ["base", "top"],
          exercise: "",
          hints: 0,
          evidence: { base: "Proved" },
        }),
      ),
    ProjectWork: (s) =>
      s
        .t("goal", "solo", "--write")
        .pipe(Effect.andThen(s.t("mode", "project"))),
  }
  const dummy: Record<string, ReadonlyArray<string>> = {
    goal: ["solo"],
    probe: [],
    mode: ["exercise"],
    check: [],
    hint: [],
    solution: [],
    reset: [],
    confirm: ["app.ts", "--quote", "x"],
  }

  for (const phase of Phase.literals) {
    live(
      `${phase === "Menu" ? "the first step" : phase === "Replaying" ? "in the replay" : phase === "Working" ? "while working on the exercise" : "after a goal"} refuses every command its row does not list and shows every one it does`,
      Effect.gen(function* () {
        const s = yield* session()
        yield* reach[phase](s)
        for (const name of commandNames.filter((n) => !allows(phase, n))) {
          const r = yield* s.t(name, ...dummy[name]!)
          assert.strictEqual(r.code, 1, name)
          assert.include(r.out, "Not now.", name)
        }
        const status = yield* s.t("status")
        for (const action of machine[phase])
          assert.include(status.out, action.cli)
      }),
    )
  }
})

describe("exercise mode", () => {
  live(
    "writes nothing until the learner names a folder",
    Effect.gen(function* () {
      const s = yield* session()
      yield* s.t("goal", "solo", "--write")
      const r = yield* s.t("mode", "exercise")
      assert.strictEqual(r.code, 0)
      assert.match(r.out, /folder name/)
      assert.deepStrictEqual(yield* s.files, [".effect-tutor.json"])
      assert.strictEqual(yield* s.installs, "")
    }),
  )

  live(
    "writes the starter, package.json and tsconfig.json in the named folder and says why",
    Effect.gen(function* () {
      const s = yield* session()
      yield* s.t("goal", "solo", "--write")
      const r = yield* s.t("mode", "exercise", "practice")
      assert.strictEqual(r.code, 0)
      assert.deepStrictEqual(yield* s.read("practice/main.ts"), starter)
      assert.include(yield* s.read("practice/package.json"), '"type": "module"')
      const config = JSON.parse(yield* s.read("practice/tsconfig.json"))
      assert.strictEqual(config.compilerOptions.strict, true)
      assert.isUndefined(config.compilerOptions.types)
      assert.include(r.out, "practice/main.ts")
      assert.include(r.out, "practice/package.json")
      assert.include(r.out, "practice/tsconfig.json")
      assert.match(r.out, /editor shows types/)
      assert.strictEqual(yield* s.installs, "")
    }),
  )

  live(
    "never overwrites a file and says it kept it",
    Effect.gen(function* () {
      const s = yield* session()
      yield* s.t("goal", "solo", "--write")
      yield* s.t("mode", "exercise", "practice")
      yield* s.write("practice/main.ts", "my work")
      yield* s.write("practice/package.json", '{"name":"mine"}')
      const r = yield* s.t("mode", "exercise", "practice")
      assert.strictEqual(r.code, 0)
      assert.strictEqual(yield* s.read("practice/main.ts"), "my work")
      assert.strictEqual(
        yield* s.read("practice/package.json"),
        '{"name":"mine"}',
      )
      assert.include(r.out, "Kept practice/main.ts")
      assert.include(r.out, "Kept practice/package.json")
      assert.include(r.out, "Kept practice/tsconfig.json")
      assert.notInclude(r.out, "Wrote")
    }),
  )

  live(
    "a parent package.json with effect gets only the starter file and no install",
    Effect.gen(function* () {
      const s = yield* session()
      yield* s.write(
        "package.json",
        JSON.stringify({ dependencies: { effect: "^4.0.0" } }),
      )
      yield* s.t("goal", "solo", "--write")
      const r = yield* s.t("mode", "exercise", "sub/practice", "--install")
      assert.strictEqual(r.code, 0)
      assert.deepStrictEqual(yield* s.read("sub/practice/main.ts"), starter)
      assert.deepStrictEqual(yield* s.files, [
        ".effect-tutor.json",
        "package.json",
        "sub",
      ])
      assert.deepStrictEqual(yield* s.nested("sub/practice"), ["main.ts"])
      assert.include(r.out, "already has effect")
      assert.strictEqual(yield* s.installs, "")
    }),
  )

  live(
    "a package.json with effect in the folder itself gets only the starter file",
    Effect.gen(function* () {
      const s = yield* session()
      yield* s.write(
        "practice/package.json",
        JSON.stringify({ devDependencies: { effect: "^4.0.0" } }),
      )
      yield* s.t("goal", "solo", "--write")
      const r = yield* s.t("mode", "exercise", "practice", "--install")
      assert.strictEqual(r.code, 0)
      assert.deepStrictEqual(yield* s.nested("practice"), [
        "main.ts",
        "package.json",
      ])
      assert.strictEqual(yield* s.installs, "")
    }),
  )

  live(
    "installs effect and typescript only when the yes flag is passed, and says so",
    Effect.gen(function* () {
      const s = yield* session()
      yield* s.t("goal", "solo", "--write")
      const no = yield* s.t("mode", "exercise", "practice")
      assert.strictEqual(yield* s.installs, "")
      assert.match(no.out, /--install/)
      const yes = yield* s.t("mode", "exercise", "practice", "--install")
      assert.strictEqual(yes.code, 0)
      assert.match(
        yield* s.installs,
        /practice :: install effect typescript\n$/,
      )
      assert.include(yes.out, "Installed effect and typescript")
    }),
  )

  live(
    "refuses a folder outside the current folder and writes nothing",
    Effect.gen(function* () {
      const s = yield* session()
      yield* s.t("goal", "solo", "--write")
      const r = yield* s.t("mode", "exercise", "../escape")
      assert.strictEqual(r.code, 1)
      assert.include(r.out, "relative path")
      assert.deepStrictEqual(yield* s.files, [".effect-tutor.json"])
    }),
  )
})

describe("a missing npm", () => {
  live(
    "refuses the install with a clear message and does not crash",
    Effect.gen(function* () {
      const s = yield* session({ install: "missing" })
      yield* s.t("goal", "solo", "--write")
      const r = yield* s.t("mode", "exercise", "practice", "--install")
      assert.strictEqual(r.code, 1)
      assert.include(r.out, "npm")
      assert.match(r.out, /not found|not installed/)
      assert.notInclude(r.out, "at ")
    }),
  )
})

const solution = solutionOf("solo")

const baseSolution = solutionOf("base")

const partial = { middle: "Proved" } as const

const revisiting = { base: "Proved", middle: "Explained" } as const

const seeded = Effect.gen(function* () {
  const s = yield* session()
  yield* s.write(
    ".effect-tutor.json",
    JSON.stringify({
      phase: "Menu",
      goal: "",
      path: [],
      exercise: "",
      hints: 0,
      evidence: partial,
    }),
  )
  yield* s.t("goal", "top", "--write")
  yield* s.t("mode", "exercise", "practice")
  return s
})

const working = (goal = "solo") =>
  Effect.gen(function* () {
    const s = yield* session()
    yield* s.t("goal", goal, "--write")
    yield* s.t("mode", "exercise", "practice")
    return s
  })

describe("check", () => {
  live(
    "after the folder is chosen, status names the exercise file",
    Effect.gen(function* () {
      const s = yield* working()
      const r = yield* s.t("status")
      assert.include(r.out, "practice/main.ts")
    }),
  )

  live(
    "a passing check records proved and moves to the next concept",
    Effect.gen(function* () {
      const s = yield* working("top")
      yield* s.write("practice/main.ts", baseSolution)
      const r = yield* s.t("check")
      assert.strictEqual(r.code, 0, r.out)
      assert.include(r.out, "PASSED")
      assert.include(r.out, "tutor replay")
      assert.notInclude(r.out, "tutor check")
      assert.include(yield* s.read(".effect-tutor.json"), '"base":"Proved"')
    }),
  )

  live(
    "a passing check that leaves more concepts offers the replay",
    Effect.gen(function* () {
      const s = yield* working("top")
      yield* s.write("practice/main.ts", baseSolution)
      const r = yield* s.t("check")
      assert.strictEqual(r.code, 0, r.out)
      assert.include(r.out, "tutor replay answered")
      assert.include(r.out, "tutor replay skipped")
      assert.notInclude(r.out, "tutor check")
    }),
  )

  live(
    "a skipped replay moves on to the next concept",
    Effect.gen(function* () {
      const s = yield* seeded
      yield* s.write("practice/main.ts", baseSolution)
      yield* s.t("check")
      const r = yield* s.t("replay", "skipped")
      assert.strictEqual(r.code, 0, r.out)
      assert.include(r.out, "tutor mode project")
      assert.notInclude(r.out, "tutor replay")
      assert.include(yield* s.read(".effect-tutor.json"), '"path":["top"]')
    }),
  )

  live(
    "a passing check on the last concept returns to the goal menu",
    Effect.gen(function* () {
      const s = yield* working()
      yield* s.write("practice/main.ts", solution)
      const r = yield* s.t("check")
      assert.strictEqual(r.code, 0, r.out)
      assert.include(r.out, "tutor goal")
    }),
  )

  live(
    "the last concept ends the goal at once and the list hides the finished goal",
    Effect.gen(function* () {
      const s = yield* working()
      yield* s.write("practice/main.ts", solution)
      const r = yield* s.t("check")
      assert.include(r.out, "The goal is reached")
      assert.notInclude(r.out, "tutor replay")
      assert.notInclude(r.out, "solo:")
      assert.include(r.out, "top:")
      assert.include(r.out, "tutor goal")
    }),
  )

  live(
    "a failed check on an edited file sends the learner to a concept that is only explained",
    Effect.gen(function* () {
      const s = yield* session()
      yield* s.write(
        ".effect-tutor.json",
        JSON.stringify({
          phase: "Menu",
          goal: "",
          path: [],
          exercise: "",
          hints: 0,
          evidence: revisiting,
        }),
      )
      yield* s.t("goal", "top", "--write")
      yield* s.t("mode", "exercise", "practice")
      const starterText = yield* s.read("practice/main.ts")
      const untouched = yield* s.t("check")
      assert.notInclude(untouched.out, "REVISIT")
      yield* s.write("practice/main.ts", `${starterText}\n// tried\n`)
      const r = yield* s.t("check")
      assert.strictEqual(r.code, 1, r.out)
      assert.include(r.out, "REVISIT")
      assert.include(r.out, "tutor mode project")
      const state = JSON.parse(yield* s.read(".effect-tutor.json"))
      assert.deepStrictEqual(state.path, ["middle", "top"])
      assert.strictEqual(state.phase, "ChoosingMode")
      assert.deepStrictEqual(state.evidence, revisiting)
    }),
  )

  live(
    "after a revisit, proving the earlier concept leads back to the later one",
    Effect.gen(function* () {
      const s = yield* session()
      yield* s.write(
        ".effect-tutor.json",
        JSON.stringify({
          phase: "Menu",
          goal: "",
          path: [],
          exercise: "",
          hints: 0,
          evidence: revisiting,
        }),
      )
      yield* s.t("goal", "top", "--write")
      yield* s.t("mode", "exercise", "practice")
      yield* s.write("practice/main.ts", "export {}\n")
      yield* s.t("check")
      const back = yield* s.t("mode", "exercise", "again")
      assert.strictEqual(back.code, 0, back.out)
      yield* s.write("again/main.ts", solutionOf("middle"))
      const passed = yield* s.t("check")
      assert.include(passed.out, "tutor replay")
      const next = yield* s.t("replay", "answered")
      assert.include(next.out, "tutor mode project")
      assert.include(yield* s.read(".effect-tutor.json"), '"path":["top"]')
    }),
  )

  live(
    "a failing check records nothing and shows the failure",
    Effect.gen(function* () {
      const s = yield* working()
      const before = yield* s.read(".effect-tutor.json")
      const r = yield* s.t("check")
      assert.strictEqual(r.code, 1)
      assert.include(r.out, "NOT YET")
      assert.include(r.out, "tutor check")
      assert.strictEqual(yield* s.read(".effect-tutor.json"), before)
    }),
  )

  live(
    "a check with no exercise file is refused and says where the file belongs",
    Effect.gen(function* () {
      const s = yield* working()
      yield* s.remove("practice/main.ts")
      const r = yield* s.t("check")
      assert.strictEqual(r.code, 1)
      assert.include(r.out, "practice/main.ts")
    }),
  )
})

const hints = [
  "First hint of solo",
  "Second hint of solo",
  "Third hint of solo",
]

describe("hints and the solution", () => {
  live(
    "hints come in ladder order and the solution is refused before they are used",
    Effect.gen(function* () {
      const s = yield* working()
      const first = yield* s.t("hint")
      assert.strictEqual(first.code, 0)
      assert.include(first.out, hints[0])
      assert.notInclude(first.out, hints[1])
      const locked = yield* s.t("solution")
      assert.strictEqual(locked.code, 1)
      assert.notInclude(locked.out, "SOLVED")
      assert.include(locked.out, "tutor hint")
      const second = yield* s.t("hint")
      assert.include(second.out, hints[1])
      yield* s.t("hint")
      const none = yield* s.t("hint")
      assert.include(none.out, "No more hints")
      const open = yield* s.t("solution")
      assert.strictEqual(open.code, 0)
      assert.include(open.out, "SOLVED solo")
    }),
  )

  live(
    "the solution unlocks when the learner asks in their own words",
    Effect.gen(function* () {
      const s = yield* working()
      const r = yield* s.t("solution", "--said", "just show me")
      assert.strictEqual(r.code, 0)
      assert.include(r.out, "SOLVED solo")
    }),
  )

  live(
    "reset restores the starter and clears the hints",
    Effect.gen(function* () {
      const s = yield* working()
      yield* s.t("hint")
      yield* s.write("practice/main.ts", "my work")
      const r = yield* s.t("reset")
      assert.strictEqual(r.code, 0)
      assert.strictEqual(yield* s.read("practice/main.ts"), starter)
      const again = yield* s.t("hint")
      assert.include(again.out, hints[0])
    }),
  )
})

const seedState = (state: Record<string, unknown>) =>
  JSON.stringify({
    phase: "Menu",
    goal: "",
    path: [],
    exercise: "",
    hints: 0,
    evidence: {},
    ...state,
  })

describe("a menu with nothing left", () => {
  live(
    "says in words that no goal is left",
    Effect.gen(function* () {
      const s = yield* session()
      yield* s.write(
        ".effect-tutor.json",
        seedState({
          evidence: Object.fromEntries(
            goalConcepts.map((item) => [item.id, "Proved"]),
          ),
        }),
      )
      const r = yield* s.t("status")
      assert.include(r.out, "No goal is left")
    }),
  )
})

describe("a way out of project work", () => {
  live(
    "the learner can switch to an exercise",
    Effect.gen(function* () {
      const s = yield* session()
      yield* s.t("goal", "solo", "--write")
      yield* s.t("mode", "project")
      const r = yield* s.t("mode", "exercise", "practice")
      assert.strictEqual(r.code, 0, r.out)
      assert.strictEqual(
        JSON.parse(yield* s.read(".effect-tutor.json")).phase,
        "Working",
      )
    }),
  )
})

describe("a resumed trusted session", () => {
  live(
    "the shell probe moves on to the mode choice",
    Effect.gen(function* () {
      const s = yield* session()
      yield* s.write(
        ".effect-tutor.json",
        seedState({
          phase: "Probing",
          goal: "solo",
          path: ["base"],
          trusted: true,
        }),
      )
      const r = yield* s.t("probe")
      assert.strictEqual(r.code, 0, r.out)
      assert.include(r.out, "tutor mode")
      assert.strictEqual(
        JSON.parse(yield* s.read(".effect-tutor.json")).phase,
        "ChoosingMode",
      )
    }),
  )
})

describe("revisit", () => {
  live(
    "follows needs through a proved concept to one that is only explained",
    Effect.gen(function* () {
      const s = yield* session()
      yield* s.write(
        ".effect-tutor.json",
        seedState({
          evidence: {
            base: "Explained",
            solo: "Proved",
            middle: "Proved",
          },
        }),
      )
      yield* s.t("goal", "top", "--write")
      yield* s.t("mode", "exercise", "practice")
      const starterText = yield* s.read("practice/main.ts")
      yield* s.write("practice/main.ts", `${starterText}\n// tried\n`)
      const r = yield* s.t("check")
      assert.include(r.out, "REVISIT")
      const state = JSON.parse(yield* s.read(".effect-tutor.json"))
      assert.deepStrictEqual(state.path, ["base", "top"])
    }),
  )
})

describe("confirm on a project file", () => {
  const project = (setup: (s: Session) => Effect.Effect<unknown>) =>
    Effect.gen(function* () {
      const s = yield* session()
      yield* s.t("goal", "solo", "--write")
      yield* s.t("mode", "project")
      yield* setup(s)
      return s
    })

  live(
    "refuses a short quote and says the minimum",
    Effect.gen(function* () {
      const s = yield* project((p) => p.write("app.ts", "function a() {\n}\n"))
      const r = yield* s.t("confirm", "app.ts", "--quote", "}")
      assert.strictEqual(r.code, 1)
      assert.include(r.out, "8")
      const ok = yield* s.t("confirm", "app.ts", "--quote", "function a() {")
      assert.strictEqual(ok.code, 0, ok.out)
    }),
  )

  live(
    "accepts a file outside the project folder",
    Effect.gen(function* () {
      const file = "/elsewhere/app.ts"
      const s = yield* project((p) => p.write(file, "export const rows = 1\n"))
      const r = yield* s.t("confirm", file, "--quote", "export const rows = 1")
      assert.strictEqual(r.code, 0, r.out)
    }),
  )

  live(
    "refuses a folder and a file over the size limit",
    Effect.gen(function* () {
      const s = yield* project((p) =>
        Effect.gen(function* () {
          yield* p.write("dir.ts/inner.ts", "export const rows = 1\n")
          yield* p.write(
            "big.ts",
            `export const rows = 1\n${"x".repeat(2_000_000)}\n`,
          )
        }),
      )
      for (const file of ["dir.ts", "big.ts"]) {
        const r = yield* s.t(
          "confirm",
          file,
          "--quote",
          "export const rows = 1",
        )
        assert.strictEqual(r.code, 1, file)
      }
    }),
  )
})

describe("a broken progress file", () => {
  live(
    "is reported in words, not as a crash",
    Effect.gen(function* () {
      const s = yield* session()
      yield* s.write(".effect-tutor.json", "{ not json")
      const r = yield* s.t("status")
      assert.strictEqual(r.code, 1)
      assert.include(r.out, ".effect-tutor.json")
      assert.include(r.out, "cannot be read")
      assert.notInclude(r.out, "    at ")
    }),
  )
})

describe("a bad argument", () => {
  live(
    "a mode or replay value outside the choices is refused",
    Effect.gen(function* () {
      const s = yield* session()
      yield* s.t("goal", "solo", "--write")
      const mode = yield* s.t("mode", "sideways")
      assert.strictEqual(mode.code, 1)
    }),
  )
})
