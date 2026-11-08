import { Effect } from "effect"
import { assert, it } from "tutorial-test"
import { checkout, log } from "./main"

it("checkout returns the id of the receipt", async () => {
  log.length = 0
  assert.strictEqual(await Effect.runPromise(checkout(50)), "rc_ch_50")
})

it("checkout charges first, then sends the receipt", async () => {
  log.length = 0
  await Effect.runPromise(checkout(50))
  assert.strictEqual(log.join(","), ["charge:50", "receipt:ch_50"].join(","))
})
