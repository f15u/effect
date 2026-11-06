import { assert, describe } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { liveNode as live } from "./Live.ts"
import { session } from "./Session.ts"

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
