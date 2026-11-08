import { Schema } from "effect"
import { assert, it } from "tutorial-test"
import { Payment, PaymentToken } from "./main"

const decode = Schema.decodeUnknownSync(Payment)

const rejects = (input: unknown) => {
  try {
    decode(input)
    return false
  } catch {
    return true
  }
}

// @ts-expect-error a plain string is not a PaymentToken
export const plain: typeof PaymentToken.Type = "tok_1"

it("a positive amount is accepted", () => {
  const payment = decode({ amount: 5, token: "tok_1" })
  const token: typeof PaymentToken.Type = payment.token
  assert.strictEqual(token, "tok_1")
})

it("a zero amount is rejected", () => {
  assert.ok(rejects({ amount: 0, token: "tok_1" }))
})

it("a negative amount is rejected", () => {
  assert.ok(rejects({ amount: -50, token: "tok_1" }))
})
