import * as NodeServices from "@effect/platform-node/NodeServices"
import { assert, describe } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Layer from "effect/Layer"
import * as Path from "effect/Path"
import type { Concept } from "../src/Concept.ts"
import { concepts } from "../src/Concepts.ts"
import { ContentCheck } from "../src/ContentCheck.ts"
import { liveWith } from "./Live.ts"

const Live = ContentCheck.layer.pipe(Layer.provideMerge(NodeServices.layer))

const withFiles = (concept: Concept, swap: Readonly<Record<string, string>>) =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const dir = yield* fs.makeTempDirectoryScoped({ prefix: "concept-" })
    for (const name of ["starter.ts", "solution.ts", "goal.test.ts"] as const) {
      const from = swap[name] ?? name
      yield* fs.copyFile(path.join(concept.dir, from), path.join(dir, name))
    }
    return { ...concept, dir }
  })

const live = liveWith(Live)

describe("the content check", () => {
  for (const concept of concepts) {
    live(
      `${concept.id}: starter fails, solution passes, probe is sound`,
      Effect.gen(function*() {
        const check = yield* ContentCheck
        assert.deepStrictEqual(yield* check.check(concept), [])
      })
    )
  }

  live(
    "a starter that passes its goal test is reported",
    Effect.gen(function*() {
      const check = yield* ContentCheck
      const bad = yield* withFiles(concepts[0], {
        "starter.ts": "solution.ts"
      })
      assert.deepStrictEqual(yield* check.check(bad), [
        "the starter passes its goal test"
      ])
    })
  )

  live(
    "a solution that fails its goal test is reported",
    Effect.gen(function*() {
      const check = yield* ContentCheck
      const bad = yield* withFiles(concepts[0], {
        "solution.ts": "starter.ts"
      })
      assert.deepStrictEqual(yield* check.check(bad), [
        "the solution fails its goal test"
      ])
    })
  )

  live(
    "a probe with a distractor that has no wrong belief is reported",
    Effect.gen(function*() {
      const check = yield* ContentCheck
      const [first, ...rest] = concepts[0].probe.distractors
      const bad: Concept = {
        ...concepts[0],
        probe: {
          ...concepts[0].probe,
          distractors: [{ ...first, belief: "" }, ...rest]
        }
      }
      assert.deepStrictEqual(yield* check.check(bad), [
        `distractor "${first.text}" has no wrong belief`
      ])
    })
  )

  live(
    "a probe whose correct option is also a distractor is reported",
    Effect.gen(function*() {
      const check = yield* ContentCheck
      const probe = concepts[0].probe
      const bad: Concept = {
        ...concepts[0],
        probe: {
          ...probe,
          distractors: [
            { text: probe.correct, belief: "x" },
            ...probe.distractors.slice(1)
          ]
        }
      }
      assert.deepStrictEqual(yield* check.check(bad), [
        "the probe must have exactly one correct option"
      ])
    })
  )
})
