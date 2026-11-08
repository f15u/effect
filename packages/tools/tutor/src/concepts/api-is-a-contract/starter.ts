import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "effect/http-api"

export const PaymentRequest = Schema.Struct({
  amount: Schema.Number,
  token: Schema.String
})

export const Receipt = Schema.Struct({
  id: Schema.String,
  amount: Schema.Number
})

export class PaymentsGroup extends HttpApiGroup.make("payments") {}

export class Api extends HttpApi.make("shop").add(PaymentsGroup) {}
