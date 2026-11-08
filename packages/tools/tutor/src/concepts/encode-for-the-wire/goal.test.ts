import { Schema } from "effect"
import { assert, it } from "tutorial-test"
import { Payment } from "./main"

const wire: typeof Payment.Encoded = {
  amount: 5,
  createdAt: "2026-01-01T00:00:00.000Z"
}

it("decoding turns the string into a Date", () => {
  const payment = Schema.decodeUnknownSync(Payment)(wire)
  const createdAt: Date = payment.createdAt
  assert.ok(createdAt instanceof Date, "createdAt is not a Date")
  assert.strictEqual(createdAt.getUTCFullYear(), 2026)
})

it("encoding turns the Date back into the same string", () => {
  const payment = Schema.decodeUnknownSync(Payment)(wire)
  assert.strictEqual(
    Schema.encodeSync(Payment)(payment).createdAt,
    "2026-01-01T00:00:00.000Z"
  )
})
