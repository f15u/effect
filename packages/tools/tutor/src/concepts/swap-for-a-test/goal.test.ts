import { Effect } from "effect"
import { assert, it } from "tutorial-test"
import { checkout, Gateway } from "./main"

it("checkout runs with the test layer and makes no network call", async () => {
  const result = await Effect.runPromise(
    checkout(5).pipe(Effect.provide(Gateway.layerTest))
  )
  assert.strictEqual(result, "paid ch_test")
})
