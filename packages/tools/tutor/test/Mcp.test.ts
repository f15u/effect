import { assert, describe, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import type * as Scope from "effect/Scope"
import { commandNames } from "../src/Machine.ts"
import { nothingForNow } from "../src/Commands.ts"
import { notSure, probeOptions } from "../src/Concept.ts"
import { defineConcept, type Concept } from "../src/Concept.ts"
import type { Content } from "./Harness.ts"
import {
  mcpSession as openMcpSession,
  type McpOptions,
  type ElicitAnswer,
  type ElicitRequest,
} from "./McpHarness.ts"

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

const mcpSession = (options: McpOptions = {}) =>
  openMcpSession({ ...content, ...options })

const canAsk = { elicitation: { form: {} } }

const unsure =
  (rest: (request: ElicitRequest) => ElicitAnswer) =>
  (request: ElicitRequest): ElicitAnswer =>
    request.properties.choice === undefined
      ? rest(request)
      : choices(request).includes(nothingForNow)
        ? pick(solo.goal!)
        : pick(notSure)

const solution = solutionOf("solo")

const live = <A, E>(name: string, body: Effect.Effect<A, E, Scope.Scope>) =>
  it.live(name, () => Effect.scoped(body))

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
      const head = s.init.instructions.slice(0, 512)
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
    "the first goal call names the state file and writes nothing; the repeat writes",
    Effect.gen(function* () {
      const s = yield* mcpSession()
      const first = yield* s.tool("tutor_goal", { goals: ["solo"] })
      assert.isFalse(first.isError)
      assert.include(first.out, ".effect-tutor.json")
      assert.include(first.out, "write")
      assert.deepStrictEqual(yield* s.files, [])
      yield* s.tool("tutor_goal", { goals: ["solo"], write: true })
      assert.deepStrictEqual(yield* s.files, [".effect-tutor.json"])
    }),
  )

  live(
    "the picker names the state file before anything is written",
    Effect.gen(function* () {
      const s = yield* mcpSession({
        capabilities: canAsk,
        answer: (request) =>
          request.message.includes(".effect-tutor.json")
            ? pick(top.goal!)
            : { action: "decline" },
      })
      const goal = yield* s.tool("tutor_goal")
      assert.isFalse(goal.isError)
      assert.include(s.asked[0]!.message, ".effect-tutor.json")
      assert.strictEqual((yield* s.state).goal, "top")
    }),
  )

  live(
    "a whole exercise through the tools writes no agent file",
    Effect.gen(function* () {
      const s = yield* mcpSession()
      const goal = yield* s.tool("tutor_goal", {
        goals: ["solo"],
        write: true,
      })
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
        answer: unsure((request) =>
          request.properties.folder !== undefined
            ? { action: "accept", content: { folder: "practice" } }
            : { action: "accept", content: { install: false } },
        ),
      })
      yield* s.tool("tutor_goal", { goals: ["solo"], write: true })
      yield* s.tool("tutor_probe")
      const done = yield* s.tool("tutor_mode", { mode: "exercise" })
      assert.isFalse(done.isError)
      const form = s.asked.find((item) => item.properties.folder !== undefined)!
      assert.isUndefined(form.properties.folder?.default)
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
          answer: unsure((request) =>
            request.properties.folder !== undefined
              ? { action: "accept", content: { folder: "practice" } }
              : { action: "accept", content: { install: yes } },
          ),
        })
      const no = yield* reply(false)
      yield* no.tool("tutor_goal", { goals: ["solo"], write: true })
      yield* no.tool("tutor_probe")
      yield* no.tool("tutor_mode", { mode: "exercise", install: true })
      assert.strictEqual(yield* no.installs, "")
      const yes = yield* reply(true)
      yield* yes.tool("tutor_goal", { goals: ["solo"], write: true })
      yield* yes.tool("tutor_probe")
      yield* yes.tool("tutor_mode", { mode: "exercise" })
      assert.include(yield* yes.installs, "install effect typescript")
    }),
  )

  live(
    "a declined folder form writes nothing and leaves the choice open",
    Effect.gen(function* () {
      const s = yield* mcpSession({
        capabilities: { elicitation: {} },
        answer: unsure(() => ({ action: "decline" })),
      })
      yield* s.tool("tutor_goal", { goals: ["solo"], write: true })
      yield* s.tool("tutor_probe")
      const out = yield* s.tool("tutor_mode", { mode: "exercise" })
      assert.isTrue(out.isError)
      assert.deepStrictEqual(yield* s.files, [".effect-tutor.json"])
    }),
  )

  live(
    "without elicitation nothing is written until the agent passes a name, and the tool says what it writes",
    Effect.gen(function* () {
      const s = yield* mcpSession()
      yield* s.tool("tutor_goal", { goals: ["solo"], write: true })
      yield* s.tool("tutor_probe")
      const ask = yield* s.tool("tutor_mode", { mode: "exercise" })
      assert.include(ask.out, "folder name")
      assert.deepStrictEqual(yield* s.files, [".effect-tutor.json"])
      assert.deepStrictEqual(s.asked, [])
      const list = yield* s.rawTools
      const mode = list.find((item) => item.name === "tutor_mode")!
      for (const file of ["main.ts", "package.json", "tsconfig.json"])
        assert.include(mode.description ?? "", file)
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
        answer: () => pick(top.goal!),
      })
      const goal = yield* s.tool("tutor_goal", {
        goals: ["solo"],
        write: true,
      })
      const state = yield* s.state
      assert.strictEqual(state.goal, "top")
      assert.strictEqual(state.trusted, true)
      assert.include(goal.out, top.goal!)
      assert.sameMembers(
        [...choices(s.asked[0]!)],
        [
          ...stubConcepts.flatMap((item) => (item.goal ? [item.goal] : [])),
          nothingForNow,
        ],
      )
      assert.strictEqual(choices(s.asked[0]!).at(-1), nothingForNow)
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
        answer: () => pick(nothingForNow),
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
            stubConcepts.map((item) => [item.id, "Proved"]),
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
      const goal = yield* s.tool("tutor_goal", {
        goals: ["solo"],
        write: true,
      })
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
    choices(request).includes(nothingForNow) ? pick(goal) : probe(request)

const pick = (choice: string, words?: string): ElicitAnswer => ({
  action: "accept",
  content: { choice, ...(words === undefined ? {} : { words }) },
})

const choices = (request: ElicitRequest): ReadonlyArray<string> =>
  request.properties.choice?.enum ?? []

describe("tutor mcp probe", () => {
  live(
    "a correct pick records explained and skips the concept; the text is not evidence",
    Effect.gen(function* () {
      const s = yield* mcpSession({
        capabilities: canAsk,
        answer: learner(solo.goal!, () =>
          pick(solo.probe.correct, "I know all of Effect"),
        ),
      })
      const goal = yield* s.tool("tutor_goal")
      assert.include(goal.out, "tutor_probe")
      assert.notInclude(goal.out, solo.probe.correct)
      assert.strictEqual((yield* s.state).phase, "Probing")
      const probe = yield* s.tool("tutor_probe")
      assert.isFalse(probe.isError)
      const request = s.asked[1]!
      assert.include(request.message, solo.probe.question)
      assert.sameMembers([...choices(request)], [...probeOptions(solo)])
      assert.strictEqual(choices(request).at(-1), notSure)
      assert.sameMembers(Object.keys(request.properties), ["choice", "words"])
      const state = yield* s.state
      assert.deepStrictEqual(state.evidence, { solo: "Explained" })
      assert.strictEqual(state.phase, "Menu")
      assert.include(probe.out, "I know all of Effect")
    }),
  )

  live(
    "a wrong pick, not sure, or a declined form leads into the concept with no evidence",
    Effect.gen(function* () {
      const wrong = solo.probe.distractors[0]!
      for (const answer of [
        pick(wrong.text, solo.probe.correct),
        pick(notSure),
        { action: "decline" } as ElicitAnswer,
      ]) {
        const s = yield* mcpSession({
          capabilities: canAsk,
          answer: learner(solo.goal!, () => answer),
        })
        yield* s.tool("tutor_goal")
        const probe = yield* s.tool("tutor_probe")
        const state = yield* s.state
        assert.deepStrictEqual(state.evidence, {})
        assert.strictEqual(state.phase, "ChoosingMode")
        assert.include(probe.out, "tutor_mode")
        if (answer.action === "accept" && answer.content.choice === wrong.text)
          assert.include(probe.out, wrong.belief)
      }
    }),
  )

  live(
    "the probe tool takes no argument that records a pick",
    Effect.gen(function* () {
      const s = yield* mcpSession({
        capabilities: canAsk,
        answer: learner(solo.goal!, () => pick(notSure)),
      })
      yield* s.tool("tutor_goal")
      yield* s.tool("tutor_probe", {
        choice: solo.probe.correct,
        answer: solo.probe.correct,
        words: solo.probe.correct,
      })
      assert.deepStrictEqual((yield* s.state).evidence, {})
      const listed = yield* s.tools
      assert.include(listed, "tutor_probe")
    }),
  )
})

describe("tutor mcp replay", () => {
  live(
    "an answered replay on a trusted session goes to the next probe",
    Effect.gen(function* () {
      const s = yield* mcpSession({ capabilities: canAsk })
      yield* s.write(
        ".effect-tutor.json",
        JSON.stringify({
          phase: "Replaying",
          goal: "top",
          path: ["solo", "top"],
          exercise: "",
          hints: 0,
          evidence: { solo: "Proved" },
          trusted: true,
        }),
      )
      assert.include(yield* s.tools, "tutor_replay")
      const bad = yield* s.tool("tutor_replay", { how: "later" })
      assert.isTrue(bad.isError)
      const r = yield* s.tool("tutor_replay", { how: "answered" })
      assert.isFalse(r.isError)
      assert.include(r.out, "tutor_probe")
      const state = yield* s.state
      assert.strictEqual(state.phase, "Probing")
      assert.deepStrictEqual(state.path, ["top"])
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
        ? pick(solo.goal!)
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
        solo: "Explained",
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
              ? pick(top.goal!)
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
          evidence: { middle: "Proved" },
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
      assert.deepStrictEqual(state.path, ["base", "top"])
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
        assert.deepStrictEqual(state.path, ["solo"])
      }
    }),
  )

  live(
    "a client with no picker gets the file check only and no evidence",
    Effect.gen(function* () {
      const s = yield* mcpSession()
      yield* s.write("db.ts", "export const rows = 1\n")
      yield* s.tool("tutor_goal", { goals: ["solo"], write: true })
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

describe("tutor mcp review fixes", () => {
  live(
    "a trusted state resumed with a client that cannot ask moves on to the mode choice",
    Effect.gen(function* () {
      const s = yield* mcpSession()
      yield* s.write(
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
      )
      const r = yield* s.tool("tutor_probe")
      assert.isFalse(r.isError)
      assert.include(r.out, "tutor_mode")
      assert.strictEqual((yield* s.state).phase, "ChoosingMode")
    }),
  )

  live(
    "a project yes never downgrades a proved concept",
    Effect.gen(function* () {
      const s = yield* mcpSession({ capabilities: canAsk, answer: owner(yes) })
      yield* s.write("db.ts", "export const rows = 1\n")
      yield* s.write(
        ".effect-tutor.json",
        JSON.stringify({
          phase: "ProjectWork",
          goal: "solo",
          path: ["solo"],
          exercise: "",
          hints: 0,
          evidence: { solo: "Proved" },
        }),
      )
      yield* s.tool("tutor_confirm", {
        file: "db.ts",
        quote: "export const rows = 1",
      })
      assert.deepStrictEqual((yield* s.state).evidence, {
        solo: "Proved",
      })
    }),
  )

  live(
    "a client that can ask always gets the folder form, whatever folder the agent names",
    Effect.gen(function* () {
      const s = yield* mcpSession({
        capabilities: canAsk,
        answer: (request) =>
          request.properties.folder
            ? { action: "accept", content: { folder: "learner" } }
            : request.properties.install
              ? { action: "accept", content: { install: false } }
              : choices(request).includes(nothingForNow)
                ? pick(solo.goal!)
                : pick(notSure),
      })
      yield* s.tool("tutor_goal")
      yield* s.tool("tutor_probe")
      yield* s.tool("tutor_mode", { mode: "exercise", folder: "agent-pick" })
      assert.isTrue(s.asked.some((item) => item.properties.folder))
      const names = yield* s.files
      assert.include(names, "learner")
      assert.notInclude(names, "agent-pick")
    }),
  )
})
