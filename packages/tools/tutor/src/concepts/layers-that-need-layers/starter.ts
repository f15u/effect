import { Context, Effect, Layer } from "effect"

export interface Charge {
  readonly id: string
  readonly amount: number
}

export class Http extends Context.Service<Http, {
  readonly post: (path: string, amount: number) => Effect.Effect<string>
}>()("app/Http") {
  static readonly layer = Layer.succeed(Http, {
    post: (path, amount) => Effect.succeed(`${path}:${amount}`)
  })
}

export class Gateway extends Context.Service<Gateway, {
  readonly charge: (amount: number) => Effect.Effect<Charge>
}>()("app/Gateway") {
  static readonly layerNoDeps = Layer.effect(
    Gateway,
    Effect.gen(function*() {
      const http = yield* Http
      return Gateway.of({
        charge: Effect.fn("Gateway.charge")(function*(amount: number) {
          const id = yield* http.post("/charges", amount)
          return { id, amount }
        })
      })
    })
  )

  static readonly layer = this.layerNoDeps
}

export const checkout = Effect.fn("checkout")(function*(amount: number) {
  const gateway = yield* Gateway
  const charge = yield* gateway.charge(amount)
  return `paid ${charge.id}`
})
