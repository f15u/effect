import { Effect } from "effect"

export interface Charge {
  readonly id: string
  readonly amount: number
}

export interface Gateway {
  readonly charge: (amount: number) => Effect.Effect<Charge>
}
