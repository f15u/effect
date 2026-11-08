import { Context, Effect, Layer } from "effect"

export interface Charge {
  readonly id: string
  readonly amount: number
}

export class Gateway extends Context.Service<Gateway, {
  readonly charge: (amount: number) => Effect.Effect<Charge>
}>()("app/Gateway") {
  static readonly layer = Layer.succeed(Gateway, {
    charge: () => Effect.die("real network call")
  })
}

export const checkout = Effect.fn("checkout")(function*(amount: number) {
  const gateway = yield* Gateway
  const charge = yield* gateway.charge(amount)
  return `paid ${charge.id}`
})
