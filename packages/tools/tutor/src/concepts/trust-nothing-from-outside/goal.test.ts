import { assert, it } from "tutorial-test"
import { readPayment } from "./main"

it("a correct payload is accepted", () => {
  const payment = readPayment("{\"amount\":5,\"token\":\"tok_1\"}")
  assert.strictEqual(payment?.amount, 5)
  assert.strictEqual(payment?.token, "tok_1")
})

it("an amount that is a string is refused", () => {
  assert.strictEqual(readPayment("{\"amount\":\"5\",\"token\":\"tok_1\"}"), undefined)
})

it("a missing token is refused", () => {
  assert.strictEqual(readPayment("{\"amount\":5}"), undefined)
})

it("a payload that is not an object is refused", () => {
  assert.strictEqual(readPayment("null"), undefined)
})
