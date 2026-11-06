import { assert, it } from "tutorial-test"
import { processPayment } from "./main"

it("a provider timeout gets a 503 reply", async () => {
  const response = await processPayment("tok_timeout").catch(() => {
    throw new Error("the NetworkError is not handled")
  })
  assert.strictEqual(response.status, 503)
  assert.strictEqual(await response.text(), "Payment provider unavailable")
})

it("an expired card still gets a 402 reply", async () => {
  const response = await processPayment("tok_expiredcard")
  assert.strictEqual(response.status, 402)
})

it("an invalid token still gets a 400 reply", async () => {
  const response = await processPayment("tok_invalid")
  assert.strictEqual(response.status, 400)
})
