import { assert, describe, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { commandNames } from "../src/Machine.ts"
import * as NodeFs from "node:fs"
import { mcpSession, TestLayer } from "./Session.ts"

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
      const s = yield* mcpSession
      const names = yield* s.tools
      for (const name of [...commandNames, "status"])
        assert.include(names, `tutor_${name}`)
    }),
  )

  live(
    "the first 512 characters of the instructions hold the key rules",
    Effect.gen(function* () {
      const s = yield* mcpSession
      const head = (s.init.result.instructions as string).slice(0, 512)
      assert.include(head, "Never show the learner the")
      assert.include(head, "plain chat message")
      assert.include(head, "Never judge or invent the learner's answer")
    }),
  )

  live(
    "refuses a tool outside the phase with the same table, and names tools not commands",
    Effect.gen(function* () {
      const s = yield* mcpSession
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
      const s = yield* mcpSession
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
})
