import { assert, describe, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import { allows, commandNames, machine } from "../src/Machine.ts"
import type { Phase } from "../src/Progress.ts"
import * as NodeFs from "node:fs"
import { session, TestLayer } from "./Session.ts"

const starter = NodeFs.readFileSync(
  new URL("../src/concepts/tagged-errors/starter.ts", import.meta.url),
  "utf8",
)

const live = <A, E>(name: string, body: Effect.Effect<A, E, any>) =>
  it.live(
    name,
    () =>
      body.pipe(Effect.scoped, Effect.provide(TestLayer)) as Effect.Effect<
        A,
        E
      >,
  )

describe("status in an empty folder", () => {
  live(
    "shows the goals and what to do next, and writes no file",
    Effect.gen(function* () {
      const s = yield* session()
      const r = yield* s.t("status")
      assert.strictEqual(r.code, 0)
      assert.include(r.out, "See every way my code can fail")
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
      const r = yield* s.t("goal", "tagged-errors")
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
      yield* s.t("goal", "tagged-errors")
      const r = yield* s.t("goal", "tagged-errors", "--write")
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
      yield* s.t("goal", "tagged-errors", "--write")
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
      const r = yield* s.t("goal", "catch-a-defect", "--write")
      assert.strictEqual(r.code, 0)
      const first = r.out.indexOf("Errors that TypeScript can tell apart")
      const second = r.out.indexOf(
        "Containing an unexpected failure at a boundary",
      )
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
          evidence: { "tagged-errors": "Proved" },
        }),
      )
      const r = yield* s.t("goal", "catch-a-defect", "--write")
      assert.strictEqual(r.code, 0)
      assert.include(r.out, "Containing an unexpected failure at a boundary")
      assert.notInclude(r.out, "Errors that TypeScript can tell apart")
    }),
  )
})

describe("the menu", () => {
  live(
    "lists goals in plain words and hides a finished goal",
    Effect.gen(function* () {
      const s = yield* session()
      const fresh = yield* s.t("status")
      assert.include(
        fresh.out,
        "Keep a server alive when something unexpected breaks",
      )
      yield* s.write(
        ".effect-tutor.json",
        JSON.stringify({
          phase: "Menu",
          goal: "",
          path: [],
          exercise: "",
          hints: 0,
          evidence: { "catch-a-defect": "Explained" },
        }),
      )
      const after = yield* s.t("status")
      assert.include(after.out, "See every way my code can fail")
      assert.notInclude(after.out, "Keep a server alive")
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
      yield* s.t("goal", "tagged-errors", "--write")
      const again = yield* s.t("goal", "catch-a-defect", "--write")
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
  const reach: Record<
    Phase,
    (
      t: (...args: Array<string>) => Effect.Effect<unknown, any, any>,
      write: (
        file: string,
        content: string,
      ) => Effect.Effect<unknown, any, any>,
    ) => Effect.Effect<unknown, any, any>
  > = {
    Menu: () => Effect.void,
    Probing: (_, write) =>
      write(
        ".effect-tutor.json",
        JSON.stringify({
          phase: "Probing",
          goal: "tagged-errors",
          path: ["tagged-errors"],
          exercise: "",
          hints: 0,
          evidence: {},
          trusted: true,
        }),
      ),
    ChoosingMode: (t) => t("goal", "tagged-errors", "--write"),
    Working: (t) =>
      t("goal", "tagged-errors", "--write").pipe(
        Effect.andThen(t("mode", "exercise", "practice")),
      ),
    ProjectWork: (t) =>
      t("goal", "tagged-errors", "--write").pipe(
        Effect.andThen(t("mode", "project")),
      ),
  }
  const dummy: Record<string, ReadonlyArray<string>> = {
    goal: ["tagged-errors"],
    probe: [],
    mode: ["exercise"],
    check: [],
    hint: [],
    solution: [],
    reset: [],
    confirm: ["app.ts", "--quote", "x"],
  }

  for (const phase of Object.keys(reach) as Array<Phase>) {
    live(
      `${phase === "Menu" ? "the first step" : phase === "Replaying" ? "in the replay" : phase === "Working" ? "while working on the exercise" : "after a goal"} refuses every command its row does not list and shows every one it does`,
      Effect.gen(function* () {
        const s = yield* session()
        yield* reach[phase](s.t, s.write)
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
      yield* s.t("goal", "tagged-errors", "--write")
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
      yield* s.t("goal", "tagged-errors", "--write")
      const r = yield* s.t("mode", "exercise", "practice")
      assert.strictEqual(r.code, 0)
      assert.deepStrictEqual(yield* s.read("practice/main.ts"), starter)
      assert.include(yield* s.read("practice/package.json"), '"type": "module"')
      assert.include(yield* s.read("practice/tsconfig.json"), "strict")
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
      yield* s.t("goal", "tagged-errors", "--write")
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
      yield* s.t("goal", "tagged-errors", "--write")
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
      yield* s.t("goal", "tagged-errors", "--write")
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
      yield* s.t("goal", "tagged-errors", "--write")
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
      yield* s.t("goal", "tagged-errors", "--write")
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
      const s = yield* session({ npm: false })
      yield* s.t("goal", "tagged-errors", "--write")
      const r = yield* s.t("mode", "exercise", "practice", "--install")
      assert.strictEqual(r.code, 1)
      assert.include(r.out, "npm")
      assert.match(r.out, /not found|not installed/)
      assert.notInclude(r.out, "at ")
    }),
  )
})

const solution = NodeFs.readFileSync(
  new URL("../src/concepts/tagged-errors/solution.ts", import.meta.url),
  "utf8",
)

const middle = {
  "typed-failure": "Proved",
  "stop-on-broken-rule": "Proved",
} as const

const revisiting = {
  "tagged-errors": "Proved",
  "typed-failure": "Proved",
  "stop-on-broken-rule": "Explained",
} as const

const stopSolution = NodeFs.readFileSync(
  new URL("../src/concepts/stop-on-broken-rule/solution.ts", import.meta.url),
  "utf8",
)

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
      evidence: middle,
    }),
  )
  yield* s.t("goal", "catch-a-defect", "--write")
  yield* s.t("mode", "exercise", "practice")
  return s
})

const working = (goal = "tagged-errors") =>
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
      const s = yield* working("catch-a-defect")
      yield* s.write("practice/main.ts", solution)
      const r = yield* s.t("check")
      assert.strictEqual(r.code, 0, r.out)
      assert.include(r.out, "PASSED")
      assert.include(r.out, "tutor replay")
      assert.notInclude(r.out, "tutor check")
      assert.include(
        yield* s.read(".effect-tutor.json"),
        '"tagged-errors":"Proved"',
      )
    }),
  )

  live(
    "a passing check that leaves more concepts offers the replay",
    Effect.gen(function* () {
      const s = yield* working("catch-a-defect")
      yield* s.write("practice/main.ts", solution)
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
      yield* s.write("practice/main.ts", solution)
      yield* s.t("check")
      const r = yield* s.t("replay", "skipped")
      assert.strictEqual(r.code, 0, r.out)
      assert.include(r.out, "tutor mode project")
      assert.notInclude(r.out, "tutor replay")
      assert.include(
        yield* s.read(".effect-tutor.json"),
        '"path":["catch-a-defect"]',
      )
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
      assert.notInclude(r.out, "tagged-errors:")
      assert.include(r.out, "catch-a-defect:")
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
      yield* s.t("goal", "catch-a-defect", "--write")
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
      assert.deepStrictEqual(state.path, [
        "stop-on-broken-rule",
        "catch-a-defect",
      ])
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
      yield* s.t("goal", "catch-a-defect", "--write")
      yield* s.t("mode", "exercise", "practice")
      yield* s.write("practice/main.ts", "export {}\n")
      yield* s.t("check")
      const back = yield* s.t("mode", "exercise", "again")
      assert.strictEqual(back.code, 0, back.out)
      yield* s.write("again/main.ts", stopSolution)
      const passed = yield* s.t("check")
      assert.include(passed.out, "tutor replay")
      const next = yield* s.t("replay", "answered")
      assert.include(next.out, "tutor mode project")
      assert.include(
        yield* s.read(".effect-tutor.json"),
        '"path":["catch-a-defect"]',
      )
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
      const fs = yield* FileSystem.FileSystem
      yield* fs.remove(`${s.dir}/practice/main.ts`)
      const r = yield* s.t("check")
      assert.strictEqual(r.code, 1)
      assert.include(r.out, "practice/main.ts")
    }),
  )
})

const hints = [
  "Compare what the three classes extend. What does Data.TaggedError add that Error does not?",
  'Import Data from "effect". Replace `extends Error` with `extends Data.TaggedError("<tag>")`. The call takes the tag as a string.',
  'The tag equals the class name, for example `class NetworkError extends Data.TaggedError("NetworkError") {}`. Do the same for the other two classes.',
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
      assert.notInclude(locked.out, "Data.TaggedError(")
      assert.include(locked.out, "tutor hint")
      const second = yield* s.t("hint")
      assert.include(second.out, hints[1])
      yield* s.t("hint")
      const none = yield* s.t("hint")
      assert.include(none.out, "No more hints")
      const open = yield* s.t("solution")
      assert.strictEqual(open.code, 0)
      assert.include(open.out, 'extends Data.TaggedError("ExpiredCardError")')
    }),
  )

  live(
    "the solution unlocks when the learner asks in their own words",
    Effect.gen(function* () {
      const s = yield* working()
      const r = yield* s.t("solution", "--said", "just show me")
      assert.strictEqual(r.code, 0)
      assert.include(r.out, 'extends Data.TaggedError("NetworkError")')
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
