import { Effect, Schema } from "effect"

export const Payment = Schema.Struct({
  amount: Schema.Number,
  token: Schema.String
})

export type Payment = typeof Payment.Type

export const readPayment = (
  input: unknown
): Effect.Effect<Payment, Schema.SchemaError> => Schema.decodeUnknownEffect(Payment)(input)
