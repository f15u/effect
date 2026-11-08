import { Context, Effect, Layer, Schema } from "effect"
import { HttpRouter, HttpServer } from "effect/http"
import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiGroup } from "effect/http-api"

export const PaymentToken = Schema.String.pipe(Schema.brand("PaymentToken"))

export const PaymentRequest = Schema.Struct({
  amount: Schema.Number.check(Schema.isGreaterThan(0)),
  token: PaymentToken
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

export class Gateway extends Context.Service<Gateway, {
  readonly charge: (
    amount: number
  ) => Effect.Effect<typeof Receipt.Type, DeclinedError>
}>()("app/Gateway") {
  static readonly layer = Layer.succeed(Gateway, {
    charge: (amount) =>
      amount > 100
        ? Effect.fail(new DeclinedError({ reason: "over the limit" }))
        : Effect.succeed({ id: `ch_${amount}`, amount })
  })
}

// Part 1: the contract. Export `Api`.
export class PaymentsGroup extends HttpApiGroup.make("payments").add(
  HttpApiEndpoint.post("create", "/payments", {
    payload: PaymentRequest,
    success: Receipt,
    error: DeclinedError
  })
) {}

export class Api extends HttpApi.make("shop").add(PaymentsGroup) {}

// Part 2: the handlers. Export `PaymentsHandlers`.
export const PaymentsHandlers = HttpApiBuilder.group(
  Api,
  "payments",
  Effect.fn(function*(handlers) {
    const gateway = yield* Gateway
    return handlers.handle("create", ({ payload }) => gateway.charge(payload.amount))
  })
)

// Part 3: the server. Export `handler` and `dispose`.
const Routes = HttpApiBuilder.layer(Api).pipe(
  Layer.provide(PaymentsHandlers.pipe(Layer.provide(Gateway.layer)))
)

export const { dispose, handler } = HttpRouter.toWebHandler(
  Routes.pipe(Layer.provide(HttpServer.layerServices)),
  { disableLogger: true }
)
