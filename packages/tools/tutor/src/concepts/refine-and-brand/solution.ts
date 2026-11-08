import { Schema } from "effect"

export const PaymentToken = Schema.String.pipe(Schema.brand("PaymentToken"))

export const Payment = Schema.Struct({
  amount: Schema.Number.check(Schema.isGreaterThan(0)),
  token: PaymentToken
})

export type Payment = typeof Payment.Type
