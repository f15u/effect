import { assert, describe, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as NodeFs from "node:fs"
import { concepts } from "../src/concepts/index.ts"
import { buildGraph } from "../src/CurriculumGraph.ts"
import { session, TestLayer } from "./Session.ts"

const live = <A, E>(name: string, body: Effect.Effect<A, E, any>) =>
  it.live(
    name,
    () =>
      body.pipe(Effect.scoped, Effect.provide(TestLayer)) as Effect.Effect<
        A,
        E
      >,
    120_000,
  )

const graph = buildGraph(concepts)
const goals = concepts.filter((item) => item.goal !== undefined)
const solutionOf = (id: string) =>
  NodeFs.readFileSync(
    new URL(`../src/concepts/${id}/solution.ts`, import.meta.url),
    "utf8",
  )

describe("every goal walks to finished", () => {
  for (const goal of goals) {
    live(
      `${goal.id}: ${goal.goal}`,
      Effect.gen(function* () {
        const path = graph.path([goal.id], new Set())
        const s = yield* session()
        const start = yield* s.t("goal", goal.id, "--write")
        assert.strictEqual(start.code, 0, start.out)
        for (const [index, id] of path.entries()) {
          const folder = `step${index}`
          if (index > 0) {
            const replay = yield* s.t("replay", "skipped")
            assert.strictEqual(replay.code, 0, replay.out)
          }
          const mode = yield* s.t("mode", "exercise", folder)
          assert.strictEqual(mode.code, 0, mode.out)
          yield* s.write(`${folder}/main.ts`, solutionOf(id))
          const check = yield* s.t("check")
          assert.strictEqual(check.code, 0, check.out)
          assert.include(check.out, "PASSED")
        }
        const last = yield* s.t("status")
        assert.notInclude(last.out, `${goal.id}:`)
        const state = JSON.parse(yield* s.read(".effect-tutor.json"))
        assert.strictEqual(state.evidence[goal.id], "Proved")
        assert.strictEqual(state.goal, "")
      }),
    )
  }
})
