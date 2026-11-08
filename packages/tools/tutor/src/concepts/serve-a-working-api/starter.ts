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

// Part 2: the handlers. Export `PaymentsHandlers`.

// Part 3: the server. Export `handler` and `dispose`.
