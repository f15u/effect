import * as NodeServices from "@effect/platform-node/NodeServices"
import { assert, describe, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { Process } from "../src/Process.ts"

const Live = Process.layer.pipe(Layer.provideMerge(NodeServices.layer))

describe("the process service", () => {
  it.live(
    "a command that does not exist fails with a MissingCommand error",
    () =>
      Effect.gen(function*() {
        const process = yield* Process
        const error = yield* process
          .execute("tutor-no-such-command", [], ".")
          .pipe(Effect.flip)
        assert.strictEqual(error.reason, "MissingCommand")
        assert.include(error.message, "tutor-no-such-command")
      }).pipe(Effect.provide(Live))
  )
})
