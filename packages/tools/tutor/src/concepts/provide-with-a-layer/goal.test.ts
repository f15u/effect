import { Effect } from "effect"
import { assert, it } from "tutorial-test"
import { checkout, Gateway } from "./main"

it("checkout runs with Gateway.layer", async () => {
  const result = await Effect.runPromise(
    checkout(5).pipe(Effect.provide(Gateway.layer))
  )
  assert.strictEqual(result, "paid ch_5")
})
