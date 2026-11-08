import { Schema } from "effect"

export const Payment = Schema.Struct({
  amount: Schema.Number,
  createdAt: Schema.DateFromString
})

export type Payment = typeof Payment.Type
