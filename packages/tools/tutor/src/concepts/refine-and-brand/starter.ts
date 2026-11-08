import { Schema } from "effect"

export const PaymentToken = Schema.String

export const Payment = Schema.Struct({
  amount: Schema.Number,
  token: PaymentToken
})

export type Payment = typeof Payment.Type
