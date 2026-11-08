import { Effect } from "effect"
import { assert, it } from "tutorial-test"
import { checkout, spans } from "./main"

it("checkout still returns the doubled amount", async () => {
  spans.length = 0
  assert.strictEqual(await Effect.runPromise(checkout(21)), 42)
})

it("each call runs inside a span named checkout", async () => {
  spans.length = 0
  await Effect.runPromise(checkout(1))
  assert.strictEqual(spans.join(","), ["checkout"].join(","))
})
