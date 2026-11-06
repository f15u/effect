import * as NodeServices from "@effect/platform-node/NodeServices"
import { assert, describe, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Layer from "effect/Layer"
import * as Path from "effect/Path"
import * as Ref from "effect/Ref"
import { Checker } from "../src/Checker.ts"

const Live = Checker.layer.pipe(Layer.provideMerge(NodeServices.layer))

const goalTest = `import { assert, it } from "tutorial-test"
import { answer } from "./main"

export const typed: number = answer

it("the answer is 42", () => {
  assert.strictEqual(answer, 42)
})
`

describe("the checker", () => {
  it.live(
    "a type error in the goal test is reported with the test as the source",
    () =>
      Effect.gen(function* () {
        const checker = yield* Checker
        const result = yield* checker.run(
          goalTest,
          `export const answer = "42"\n`,
        )
        assert.strictEqual(result._tag, "TypeErrors")
        if (result._tag === "TypeErrors")
          assert.isTrue(
            result.lines.some((line) =>
              line.startsWith("The goal test expects a different type"),
            ),
          )
      }).pipe(Effect.scoped, Effect.provide(Live)),
  )

  it.live("a check leaves no scratch folder behind", () =>
    Effect.gen(function* () {
      const created = yield* Ref.make<ReadonlyArray<string>>([])
      const Recording = Layer.effect(
        FileSystem.FileSystem,
        Effect.gen(function* () {
          const real = yield* FileSystem.FileSystem
          return {
            ...real,
            makeTempDirectoryScoped: (
              ...args: Parameters<
                FileSystem.FileSystem["makeTempDirectoryScoped"]
              >
            ) =>
              real
                .makeTempDirectoryScoped(...args)
                .pipe(
                  Effect.tap((dir) =>
                    Ref.update(created, (all) => [...all, dir]),
                  ),
                ),
          }
        }),
      ).pipe(Layer.provide(NodeServices.layer))
      const RecordingChecker = Checker.layer.pipe(
        Layer.provideMerge(Recording),
        Layer.provide(Path.layer),
      )
      yield* Effect.gen(function* () {
        const checker = yield* Checker
        yield* checker.run(goalTest, `export const answer = 42\n`)
      }).pipe(Effect.scoped, Effect.provide(RecordingChecker))
      const fs = yield* FileSystem.FileSystem
      const dirs = yield* Ref.get(created)
      assert.isAbove(dirs.length, 0)
      for (const dir of dirs) assert.isFalse(yield* fs.exists(dir), dir)
    }).pipe(Effect.provide(NodeServices.layer)),
  )

  it.live("a matching file passes", () =>
    Effect.gen(function* () {
      const checker = yield* Checker
      const result = yield* checker.run(goalTest, `export const answer = 42\n`)
      assert.strictEqual(result._tag, "Passed")
    }).pipe(Effect.scoped, Effect.provide(Live)),
  )
})
