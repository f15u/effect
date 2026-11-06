import * as NodeServices from "@effect/platform-node/NodeServices"
import { assert, describe, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import type * as FileSystem from "effect/FileSystem"
import type * as Path from "effect/Path"
import type * as Scope from "effect/Scope"
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner"
import { session } from "./Session.ts"

const live = <A, E>(
  name: string,
  body: Effect.Effect<
    A,
    E,
    | Scope.Scope
    | FileSystem.FileSystem
    | Path.Path
    | ChildProcessSpawner.ChildProcessSpawner
  >,
) =>
  it.live(name, () =>
    body.pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
  )

describe("the cli process", () => {
  live(
    "status prints what to do next and writes no file",
    Effect.gen(function* () {
      const s = yield* session()
      const r = yield* s.t("status")
      assert.strictEqual(r.code, 0)
      assert.include(r.out, "You can now:")
      assert.deepStrictEqual(yield* s.files, [])
    }),
  )

  live(
    "an argument outside the choices exits with code 1",
    Effect.gen(function* () {
      const s = yield* session()
      const r = yield* s.t("mode", "sideways")
      assert.strictEqual(r.code, 1)
    }),
  )
})
