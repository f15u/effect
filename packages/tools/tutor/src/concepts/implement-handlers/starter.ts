import { Effect, Schema } from "effect"
import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiGroup } from "effect/http-api"

export const PaymentRequest = Schema.Struct({
  amount: Schema.Number,
  token: Schema.String
})

export const Receipt = Schema.Struct({
  id: Schema.String,
  amount: Schema.Number
})

export class PaymentsGroup extends HttpApiGroup.make("payments").add(
  HttpApiEndpoint.post("create", "/payments", {
    payload: PaymentRequest,
    success: Receipt
  })
) {}

export class Api extends HttpApi.make("shop").add(PaymentsGroup) {}

export const PaymentsHandlers = HttpApiBuilder.group(
  Api,
  "payments",
  Effect.fn(function*(handlers) {
    return handlers.handle("create", () => Effect.succeed({ id: "none", amount: 0 }))
  })
)
