import { Schema } from "effect"
import { assert, it } from "tutorial-test"
import { Payment } from "./main"

const decode = Schema.decodeUnknownSync(Payment)

const rejects = (input: unknown) => {
  try {
    decode(input)
    return false
  } catch {
    return true
  }
}

it("a correct value is accepted", () => {
  const payment: Payment = decode({ amount: 5, token: "tok_1" })
  assert.strictEqual(payment.amount, 5)
  assert.strictEqual(payment.token, "tok_1")
})

it("an amount that is a string is rejected", () => {
  assert.ok(rejects({ amount: "5", token: "tok_1" }))
})

it("a missing token is rejected", () => {
  assert.ok(rejects({ amount: 5 }))
})
