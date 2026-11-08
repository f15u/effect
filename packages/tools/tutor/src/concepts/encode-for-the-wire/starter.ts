import { Schema } from "effect"

export const Payment = Schema.Struct({
  amount: Schema.Number,
  createdAt: Schema.String
})

export type Payment = typeof Payment.Type
