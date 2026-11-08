import { Effect, Layer, Schema } from "effect"
import { FetchHttpClient, HttpRouter, HttpServer } from "effect/http"
import { HttpApi, HttpApiBuilder, HttpApiClient, HttpApiEndpoint, HttpApiGroup } from "effect/http-api"

export const PaymentRequest = Schema.Struct({
  amount: Schema.Number,
  token: Schema.String
})

export const Receipt = Schema.Struct({
  id: Schema.String,
  amount: Schema.Number
})

export class DeclinedError extends Schema.TaggedError<DeclinedError>()(
  "DeclinedError",
  { reason: Schema.String },
  { httpApiStatus: 402 }
) {}

export class PaymentsGroup extends HttpApiGroup.make("payments").add(
  HttpApiEndpoint.post("create", "/payments", {
    payload: PaymentRequest,
    success: Receipt,
    error: DeclinedError
  })
) {}

export class Api extends HttpApi.make("shop").add(PaymentsGroup) {}

export const PaymentsHandlers = HttpApiBuilder.group(
  Api,
  "payments",
  Effect.fn(function*(handlers) {
    return handlers.handle("create", ({ payload }) =>
      payload.amount > 100
        ? Effect.fail(new DeclinedError({ reason: "over the limit" }))
        : Effect.succeed({ id: `rc_${payload.token}`, amount: payload.amount }))
  })
)

const Routes = HttpApiBuilder.layer(Api).pipe(
  Layer.provide(PaymentsHandlers)
)

export const { dispose, handler } = HttpRouter.toWebHandler(
  Routes.pipe(Layer.provide(HttpServer.layerServices)),
  { disableLogger: true }
)

export const pay = Effect.fn("pay")(
  function*(amount: number) {
    const client = yield* HttpApiClient.make(Api, {
      baseUrl: "http://localhost:3000"
    })
    return yield* client.payments.create({ payload: { amount, token: "tok" } })
  },
  Effect.provide(FetchHttpClient.layer)
)
