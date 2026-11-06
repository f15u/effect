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
      const r = yield* s.t("goal", "see-every-failure")
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
      yield* s.t("goal", "see-every-failure")
      const second = yield* s.t("status")
      assert.notInclude(second.out, "now writes")
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
      yield* s.t("goal", "see-every-failure")
      const again = yield* s.t("goal", "keep-server-alive")
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
    ChoosingMode: (t) => t("goal", "see-every-failure"),
  }
  const dummy: Record<string, ReadonlyArray<string>> = {
    goal: ["see-every-failure"],
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
