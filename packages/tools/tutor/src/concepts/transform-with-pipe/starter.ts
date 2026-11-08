import { Effect } from "effect"

export interface Charge {
  readonly id: string
  readonly amount: number
}

export const chargeCard = (amount: number): Effect.Effect<Charge> => Effect.succeed({ id: `ch_${amount}`, amount })

export const sendReceipt = (charge: Charge): Effect.Effect<string> => Effect.succeed(`rc_${charge.id}`)

export const receiptText = (amount: number): Effect.Effect<string> => Effect.succeed("no receipt")
