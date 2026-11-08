import { Effect } from "effect"
import { assert, it } from "tutorial-test"
import { checkout, Gateway } from "./main"

it("Gateway.layer needs nothing else, and checkout runs with it", async () => {
  const result = await Effect.runPromise(
    checkout(5).pipe(Effect.provide(Gateway.layer))
  )
  assert.strictEqual(result, "paid /charges:5")
})
