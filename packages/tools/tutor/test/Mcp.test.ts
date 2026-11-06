import { assert, describe, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { commandNames } from "../src/Machine.ts"
import * as NodeFs from "node:fs"
import { taggedErrors } from "../src/concepts/tagged-errors/concept.ts"
import { catchADefect } from "../src/concepts/catch-a-defect/concept.ts"
import { nothingForNow } from "../src/Commands.ts"
import { concepts } from "../src/concepts/index.ts"
import { notSure, probeOptions } from "../src/Concept.ts"
import {
  mcpSession,
  TestLayer,
  type ElicitAnswer,
  type ElicitRequest,
} from "./Session.ts"

const canAsk = { elicitation: { form: {} } }

const solution = NodeFs.readFileSync(
  new URL("../src/concepts/tagged-errors/solution.ts", import.meta.url),
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

describe("tutor mcp", () => {
  live(
    "exposes one tool per command of the table, plus status",
    Effect.gen(function* () {
      const s = yield* mcpSession()
      const names = yield* s.tools
      for (const name of [...commandNames, "status"])
        assert.include(names, `tutor_${name}`)
    }),
  )

  live(
    "the first 512 characters of the instructions hold the key rules",
    Effect.gen(function* () {
      const s = yield* mcpSession()
      const head = (s.init.result.instructions as string).slice(0, 512)
      assert.include(head, "Never show the learner the")
      assert.include(head, "plain chat message")
      assert.include(head, "Never judge or invent the learner's answer")
    }),
  )

  live(
    "refuses a tool outside the phase with the same table, and names tools not commands",
    Effect.gen(function* () {
      const s = yield* mcpSession()
      const status = yield* s.tool("tutor_status")
      assert.include(status.out, "tutor_goal")
      assert.notInclude(status.out, "tutor goal")
      const refused = yield* s.tool("tutor_check")
      assert.isTrue(refused.isError)
      assert.include(refused.out, "Not now.")
      assert.include(refused.out, "tutor_goal")
      const unknown = yield* s.tool("tutor_goal", { goals: ["nope"] })
      assert.isTrue(unknown.isError)
      assert.include(unknown.out, "Unknown goal")
    }),
  )

  live(
    "a whole exercise through the tools writes no agent file",
    Effect.gen(function* () {
      const s = yield* mcpSession()
      const goal = yield* s.tool("tutor_goal", { goals: ["tagged-errors"] })
      assert.include(goal.out, ".effect-tutor.json")
      const ask = yield* s.tool("tutor_mode", { mode: "exercise" })
      assert.include(ask.out, "folder name")
      assert.notInclude(ask.out, "tutor mode")
      yield* s.tool("tutor_mode", { mode: "exercise", folder: "practice" })
      assert.include((yield* s.tool("tutor_solution")).out, "LOCKED")
      assert.include((yield* s.tool("tutor_hint")).out, "HINT 1")
      const failed = yield* s.tool("tutor_check")
      assert.isTrue(failed.isError)
      yield* s.write("practice/main.ts", solution)
      assert.include((yield* s.tool("tutor_check")).out, "PASSED")
      assert.deepStrictEqual((yield* s.files).sort(), [
        ".effect-tutor.json",
        "practice",
      ])
    }),
  )

  live(
    "a client that can ask gets a folder form with no default that names every file written",
    Effect.gen(function* () {
      const s = yield* mcpSession({
        capabilities: { elicitation: {} },
        answer: (request) =>
          request.properties.folder !== undefined
            ? { action: "accept", content: { folder: "practice" } }
            : { action: "accept", content: { install: false } },
      })
      yield* s.tool("tutor_goal", { goals: ["tagged-errors"] })
      const done = yield* s.tool("tutor_mode", { mode: "exercise" })
      assert.isFalse(done.isError)
      const form = s.asked[0]!
      assert.isUndefined(form.properties.folder.default)
      for (const file of ["main.ts", "package.json", "tsconfig.json"])
        assert.include(form.message, file)
      assert.deepStrictEqual(yield* s.nested("practice"), [
        "main.ts",
        "package.json",
        "tsconfig.json",
      ])
    }),
  )

  live(
    "installs only after a yes in the form, even when the agent passes install",
    Effect.gen(function* () {
      const reply = (yes: boolean) =>
        mcpSession({
          capabilities: { elicitation: {} },
          answer: (request) =>
            request.properties.folder !== undefined
              ? { action: "accept", content: { folder: "practice" } }
              : { action: "accept", content: { install: yes } },
        })
      const no = yield* reply(false)
      yield* no.tool("tutor_goal", { goals: ["tagged-errors"] })
      yield* no.tool("tutor_mode", { mode: "exercise", install: true })
      assert.strictEqual(yield* no.installs, "")
      const yes = yield* reply(true)
      yield* yes.tool("tutor_goal", { goals: ["tagged-errors"] })
      yield* yes.tool("tutor_mode", { mode: "exercise" })
      assert.include(yield* yes.installs, "install effect typescript")
    }),
  )

  live(
    "a declined folder form writes nothing and leaves the choice open",
    Effect.gen(function* () {
      const s = yield* mcpSession({
        capabilities: { elicitation: {} },
        answer: () => ({ action: "decline" }),
      })
      yield* s.tool("tutor_goal", { goals: ["tagged-errors"] })
      const out = yield* s.tool("tutor_mode", { mode: "exercise" })
      assert.isTrue(out.isError)
      assert.deepStrictEqual(yield* s.files, [".effect-tutor.json"])
    }),
  )

  live(
    "without elicitation nothing is written until the agent passes a name, and the tool says what it writes",
    Effect.gen(function* () {
      const s = yield* mcpSession()
      yield* s.tool("tutor_goal", { goals: ["tagged-errors"] })
      const ask = yield* s.tool("tutor_mode", { mode: "exercise" })
      assert.include(ask.out, "folder name")
      assert.deepStrictEqual(yield* s.files, [".effect-tutor.json"])
      assert.deepStrictEqual(s.asked, [])
      const list = yield* s.rawTools
      const mode = list.find((item: any) => item.name === "tutor_mode")
      for (const file of ["main.ts", "package.json", "tsconfig.json"])
        assert.include(mode.description, file)
      yield* s.tool("tutor_mode", { mode: "exercise", folder: "practice" })
      assert.strictEqual(yield* s.installs, "")
      assert.deepStrictEqual(yield* s.nested("practice"), [
        "main.ts",
        "package.json",
        "tsconfig.json",
      ])
    }),
  )
})

describe("tutor mcp trusted channel", () => {
  live(
    "the learner picks the goal in a picker; the agent argument cannot choose it",
    Effect.gen(function* () {
      const s = yield* mcpSession({
        capabilities: canAsk,
        answer: () => ({ action: "accept", choice: catchADefect.goal! }),
      })
      const goal = yield* s.tool("tutor_goal", { goals: ["tagged-errors"] })
      const state = yield* s.state
      assert.strictEqual(state.goal, "catch-a-defect")
      assert.strictEqual(state.trusted, true)
      assert.include(goal.out, catchADefect.goal!)
      assert.sameMembers(
        [...choices(s.asked[0]!)],
        [
          ...concepts.flatMap((item) => (item.goal ? [item.goal] : [])),
          nothingForNow,
        ],
      )
      assert.strictEqual(s.asked[0]!.options.at(-1), nothingForNow)
    }),
  )

  live(
    "declining the picker or choosing nothing for now leaves the menu",
    Effect.gen(function* () {
      const declined = yield* mcpSession({ capabilities: canAsk })
      const first = yield* declined.tool("tutor_goal")
      assert.isTrue(first.isError)
      assert.include(first.out, "did not pick a goal")
      const nothing = yield* mcpSession({
        capabilities: canAsk,
        answer: () => ({ action: "accept", choice: nothingForNow }),
      })
      const second = yield* nothing.tool("tutor_goal")
      assert.isTrue(second.isError)
      assert.include(second.out, "nothing for now")
      assert.deepStrictEqual(yield* nothing.files, [])
    }),
  )

  live(
    "with no goal left the tool says so and opens no picker",
    Effect.gen(function* () {
      const s = yield* mcpSession({ capabilities: canAsk })
      yield* s.write(
        ".effect-tutor.json",
        JSON.stringify({
          phase: "Menu",
          goal: "",
          path: [],
          exercise: "",
          hints: 0,
          evidence: Object.fromEntries(
            concepts.map((item) => [item.id, "Proved"]),
          ),
        }),
      )
      const goal = yield* s.tool("tutor_goal")
      assert.isTrue(goal.isError)
      assert.include(goal.out, "No goal is left")
      assert.lengthOf(s.asked, 0)
    }),
  )

  live(
    "without elicitation the goal tool takes the id and opens no picker",
    Effect.gen(function* () {
      const s = yield* mcpSession()
      const goal = yield* s.tool("tutor_goal", { goals: ["tagged-errors"] })
      assert.isFalse(goal.isError)
      assert.lengthOf(s.asked, 0)
      const state = yield* s.state
      assert.notStrictEqual(state.trusted, true)
      assert.strictEqual(state.phase, "ChoosingMode")
      const probe = yield* s.tool("tutor_probe")
      assert.isTrue(probe.isError)
      assert.include(probe.out, "Not now.")
    }),
  )
})

const learner =
  (goal: string, probe: (request: ElicitRequest) => ElicitAnswer) =>
  (request: ElicitRequest): ElicitAnswer =>
    request.options.includes(nothingForNow)
      ? { action: "accept", choice: goal }
      : probe(request)

const pick = (choice: string, words?: string): ElicitAnswer => ({
  action: "accept",
  choice,
  ...(words === undefined ? {} : { words }),
})

describe("tutor mcp probe", () => {
  live(
    "a correct pick records explained and skips the concept; the text is not evidence",
    Effect.gen(function* () {
      const s = yield* mcpSession({
        capabilities: canAsk,
        answer: learner(taggedErrors.goal!, () =>
          pick(taggedErrors.probe.correct, "I know all of Effect"),
        ),
      })
      const goal = yield* s.tool("tutor_goal")
      assert.include(goal.out, "tutor_probe")
      assert.notInclude(goal.out, taggedErrors.probe.correct)
      assert.strictEqual((yield* s.state).phase, "Probing")
      const probe = yield* s.tool("tutor_probe")
      assert.isFalse(probe.isError)
      const request = s.asked[1]!
      assert.include(request.message, taggedErrors.probe.question)
      assert.sameMembers([...request.options], [...probeOptions(taggedErrors)])
      assert.strictEqual(request.options.at(-1), notSure)
      assert.sameMembers([...request.fields], ["choice", "words"])
      const state = yield* s.state
      assert.deepStrictEqual(state.evidence, { "tagged-errors": "Explained" })
      assert.strictEqual(state.phase, "Menu")
      assert.include(probe.out, "I know all of Effect")
    }),
  )

  live(
    "a wrong pick, not sure, or a declined form leads into the concept with no evidence",
    Effect.gen(function* () {
      const wrong = taggedErrors.probe.distractors[0]!
      for (const answer of [
        pick(wrong.text, taggedErrors.probe.correct),
        pick(notSure),
        { action: "decline" } as ElicitAnswer,
      ]) {
        const s = yield* mcpSession({
          capabilities: canAsk,
          answer: learner(taggedErrors.goal!, () => answer),
        })
        yield* s.tool("tutor_goal")
        const probe = yield* s.tool("tutor_probe")
        const state = yield* s.state
        assert.deepStrictEqual(state.evidence, {})
        assert.strictEqual(state.phase, "ChoosingMode")
        assert.include(probe.out, "tutor_mode")
        if (answer.action === "accept" && answer.choice === wrong.text)
          assert.include(probe.out, wrong.belief)
      }
    }),
  )

  live(
    "the probe tool takes no argument that records a pick",
    Effect.gen(function* () {
      const s = yield* mcpSession({
        capabilities: canAsk,
        answer: learner(taggedErrors.goal!, () => pick(notSure)),
      })
      yield* s.tool("tutor_goal")
      yield* s.tool("tutor_probe", {
        choice: taggedErrors.probe.correct,
        answer: taggedErrors.probe.correct,
        words: taggedErrors.probe.correct,
      })
      assert.deepStrictEqual((yield* s.state).evidence, {})
      const listed = yield* s.tools
      assert.include(listed, "tutor_probe")
    }),
  )
})

const yes = { action: "accept", content: { confirmed: true } } as const

const owner =
  (reply: ElicitAnswer) =>
  (request: ElicitRequest): ElicitAnswer =>
    request.properties.choice === undefined
      ? reply
      : choices(request).includes(nothingForNow)
        ? pick(taggedErrors.goal!)
        : pick(notSure)

describe("tutor mcp project work", () => {
  live(
    "a made-up path or quote fails the file check and records nothing",
    Effect.gen(function* () {
      const s = yield* mcpSession({ capabilities: canAsk, answer: owner(yes) })
      yield* s.write("app/db.ts", "export const rows = 1\n")
      yield* s.tool("tutor_goal")
      yield* s.tool("tutor_probe")
      yield* s.tool("tutor_mode", { mode: "project" })
      for (const args of [
        { file: "app/nope.ts", quote: "export const rows = 1" },
        { file: "app/db.ts", quote: "export const cols = 2" },
      ]) {
        const r = yield* s.tool("tutor_confirm", args)
        assert.isTrue(r.isError)
      }
      assert.lengthOf(
        s.asked.filter((item) => item.properties.confirmed),
        0,
      )
      assert.deepStrictEqual((yield* s.state).evidence, {})
    }),
  )

  live(
    "a yes in the form records explained; the form shows the path and the line",
    Effect.gen(function* () {
      const s = yield* mcpSession({ capabilities: canAsk, answer: owner(yes) })
      yield* s.write("app/db.ts", "const a = 1\nexport const rows = 1\n")
      yield* s.tool("tutor_goal")
      yield* s.tool("tutor_probe")
      yield* s.tool("tutor_mode", { mode: "project" })
      const r = yield* s.tool("tutor_confirm", {
        file: "app/db.ts",
        quote: "export const rows = 1",
      })
      assert.isFalse(r.isError)
      const form = s.asked.find((item) => item.properties.confirmed)!
      assert.include(form.message, "app/db.ts")
      assert.include(form.message, "export const rows = 1")
      assert.include(form.message, "Is this your code?")
      assert.deepStrictEqual((yield* s.state).evidence, {
        "tagged-errors": "Explained",
      })
    }),
  )

  live(
    "a yes with concepts left offers the replay; on the last concept it finishes the goal",
    Effect.gen(function* () {
      const s = yield* mcpSession({
        capabilities: canAsk,
        answer: (request) =>
          request.properties.confirmed
            ? yes
            : choices(request).includes(nothingForNow)
              ? pick(catchADefect.goal!)
              : pick(notSure),
      })
      yield* s.write("db.ts", "export const rows = 1\n")
      yield* s.write(
        ".effect-tutor.json",
        JSON.stringify({
          phase: "Menu",
          goal: "",
          path: [],
          exercise: "",
          hints: 0,
          evidence: {
            "typed-failure": "Proved",
            "stop-on-broken-rule": "Proved",
          },
        }),
      )
      yield* s.tool("tutor_goal")
      yield* s.tool("tutor_probe")
      yield* s.tool("tutor_mode", { mode: "project" })
      const r = yield* s.tool("tutor_confirm", {
        file: "db.ts",
        quote: "export const rows = 1",
      })
      assert.include(r.out, "tutor_replay")
      const state = yield* s.state
      assert.strictEqual(state.phase, "Replaying")
      assert.deepStrictEqual(state.path, ["tagged-errors", "catch-a-defect"])
      yield* s.tool("tutor_replay", { how: "skipped" })
      yield* s.tool("tutor_probe")
      yield* s.tool("tutor_mode", { mode: "project" })
      const last = yield* s.tool("tutor_confirm", {
        file: "db.ts",
        quote: "export const rows = 1",
      })
      assert.include(last.out, "The goal is reached")
      assert.notInclude(last.out, "tutor_replay")
    }),
  )

  live(
    "a no in the form records nothing and keeps the learner in project work",
    Effect.gen(function* () {
      const no = { action: "accept", content: { confirmed: false } } as const
      for (const reply of [no, { action: "decline" } as ElicitAnswer]) {
        const s = yield* mcpSession({
          capabilities: canAsk,
          answer: owner(reply),
        })
        yield* s.write("db.ts", "export const rows = 1\n")
        yield* s.tool("tutor_goal")
        yield* s.tool("tutor_probe")
        yield* s.tool("tutor_mode", { mode: "project" })
        const r = yield* s.tool("tutor_confirm", {
          file: "db.ts",
          quote: "export const rows = 1",
        })
        assert.lengthOf(
          s.asked.filter((item) => item.properties.confirmed),
          1,
        )
        assert.include(r.out, "tutor_confirm")
        const state = yield* s.state
        assert.deepStrictEqual(state.evidence, {})
        assert.deepStrictEqual(state.path, ["tagged-errors"])
      }
    }),
  )

  live(
    "a client with no picker gets the file check only and no evidence",
    Effect.gen(function* () {
      const s = yield* mcpSession()
      yield* s.write("db.ts", "export const rows = 1\n")
      yield* s.tool("tutor_goal", { goals: ["tagged-errors"] })
      yield* s.tool("tutor_mode", { mode: "project" })
      const r = yield* s.tool("tutor_confirm", {
        file: "db.ts",
        quote: "export const rows = 1",
      })
      assert.isFalse(r.isError)
      assert.lengthOf(s.asked, 0)
      assert.deepStrictEqual((yield* s.state).evidence, {})
    }),
  )

  live(
    "output never holds file contents, only source files are read, and no file changes",
    Effect.gen(function* () {
      const secret = "const token = 'hunter2-secret'"
      const code = `${secret}\nexport const rows = 1\n`
      const s = yield* mcpSession({ capabilities: canAsk, answer: owner(yes) })
      yield* s.write("db.ts", code)
      yield* s.write("notes.txt", code)
      yield* s.tool("tutor_goal")
      yield* s.tool("tutor_probe")
      yield* s.tool("tutor_mode", { mode: "project" })
      const refused = yield* s.tool("tutor_confirm", {
        file: "notes.txt",
        quote: secret,
      })
      assert.isTrue(refused.isError)
      const ok = yield* s.tool("tutor_confirm", {
        file: "db.ts",
        quote: "export const rows = 1",
      })
      for (const out of [refused.out, ok.out]) assert.notInclude(out, "hunter2")
      assert.strictEqual(yield* s.read("db.ts"), code)
      assert.strictEqual(yield* s.read("notes.txt"), code)
    }),
  )
})
