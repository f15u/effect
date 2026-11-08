import { Context, Effect } from "effect"

export interface Charge {
  readonly id: string
  readonly amount: number
}

export class Gateway extends Context.Service<Gateway, {
  readonly charge: (amount: number) => Effect.Effect<Charge>
}>()("app/Gateway") {}

export const checkout = Effect.fn("checkout")(function*(amount: number) {
  return `unpaid ${amount}`
})
