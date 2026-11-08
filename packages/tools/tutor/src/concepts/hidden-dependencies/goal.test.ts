import { assert, it } from "tutorial-test"
import { checkout, type Gateway } from "./main"

const fake: Gateway = {
  charge: async (amount) => ({ id: `fake_${amount}`, amount })
}

it("checkout uses the gateway that the caller passes", async () => {
  assert.strictEqual(await checkout(5, fake), "paid fake_5")
})

it("checkout follows the amount", async () => {
  assert.strictEqual(await checkout(9, fake), "paid fake_9")
})
