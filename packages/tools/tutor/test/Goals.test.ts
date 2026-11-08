import { assert, describe } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as NodeFs from "node:fs"
import { concepts } from "../src/Concepts.ts"
import { Curriculum } from "../src/Curriculum.ts"
import { buildGraph } from "../src/CurriculumGraph.ts"
import { State } from "../src/Progress.ts"
import { liveNode } from "./Live.ts"
import { session } from "./Session.ts"

const graph = buildGraph(concepts)
const goals = concepts.filter((item) => item.goal !== undefined)
const solutionOf = (id: string) =>
  NodeFs.readFileSync(
    new URL(`../src/concepts/${id}/solution.ts`, import.meta.url),
    "utf8"
  )

describe("every goal walks to finished", () => {
  for (const goal of goals) {
    liveNode(
      `${goal.id}: ${goal.goal}`,
      Effect.gen(function*() {
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
        const state = yield* Schema.decodeUnknownEffect(
          Schema.fromJsonString(State)
        )(yield* s.read(".effect-tutor.json"))
        assert.strictEqual(state.evidence[goal.id], "Proved")
        assert.strictEqual(state.goal, "")
      }),
      120_000
    )
  }
})

describe("the curriculum", () => {
  liveNode(
    "a goal that does not exist is refused, and every real goal is accepted",
    Effect.gen(function*() {
      const curriculum = yield* Curriculum
      const error = yield* curriculum.validateGoals(["nope"]).pipe(Effect.flip)
      assert.strictEqual(error.reason, "UnknownGoal")
      yield* curriculum.validateGoals(goals.map((item) => item.id))
    }).pipe(Effect.provide(Curriculum.layer))
  )
})
