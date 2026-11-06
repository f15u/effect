import { assert, describe, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { allows, commandNames, machine } from "../src/Machine.ts"
import type { Phase } from "../src/Progress.ts"
import { session, TestLayer } from "./Session.ts"

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
      const s = yield* session
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
    "names the state file and says why, then writes it",
    Effect.gen(function* () {
      const s = yield* session
      const r = yield* s.t("goal", "tagged-errors")
      assert.strictEqual(r.code, 0)
      assert.include(r.out, ".effect-tutor.json")
      assert.match(r.out, /progress/)
      assert.deepStrictEqual(yield* s.files, [".effect-tutor.json"])
      const again = yield* s.t("status")
      assert.include(again.out, "exercise")
    }),
  )

  live(
    "the notice comes once, not on later writes",
    Effect.gen(function* () {
      const s = yield* session
      yield* s.t("goal", "tagged-errors")
      const second = yield* s.t("status")
      assert.notInclude(second.out, "now writes")
    }),
  )
})

describe("a goal and its path", () => {
  live(
    "a goal built on another concept gives the path in order",
    Effect.gen(function* () {
      const s = yield* session
      const r = yield* s.t("goal", "catch-a-defect")
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
      const s = yield* session
      yield* s.write(
        ".effect-tutor.json",
        JSON.stringify({
          phase: "Menu",
          goal: "",
          path: [],
          evidence: { "tagged-errors": "Proved" },
        }),
      )
      const r = yield* s.t("goal", "catch-a-defect")
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
      const s = yield* session
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
      const s = yield* session
      const refused = yield* s.t("mode", "exercise")
      assert.strictEqual(refused.code, 1)
      assert.include(refused.out, "Not now.")
      assert.include(refused.out, "tutor goal")
      yield* s.t("goal", "tagged-errors")
      const again = yield* s.t("goal", "catch-a-defect")
      assert.strictEqual(again.code, 1)
      assert.include(again.out, "Not now.")
      assert.include(again.out, "tutor mode exercise")
    }),
  )

  live(
    "an unknown goal is refused and writes nothing",
    Effect.gen(function* () {
      const s = yield* session
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
    ) => Effect.Effect<unknown, any, any>
  > = {
    Menu: () => Effect.void,
    ChoosingMode: (t) => t("goal", "tagged-errors"),
  }
  const dummy: Record<string, ReadonlyArray<string>> = {
    goal: ["tagged-errors"],
    mode: ["exercise"],
  }

  for (const phase of Object.keys(machine) as Array<Phase>) {
    live(
      `${phase === "Menu" ? "the first step" : "after a goal"} refuses every command its row does not list and shows every one it does`,
      Effect.gen(function* () {
        const s = yield* session
        yield* reach[phase](s.t)
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
