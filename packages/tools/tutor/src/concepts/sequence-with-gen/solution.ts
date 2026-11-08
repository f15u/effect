import { Effect } from "effect"

export interface Charge {
  readonly id: string
  readonly amount: number
}

export const log: Array<string> = []

export const chargeCard = (amount: number): Effect.Effect<Charge> =>
  Effect.sync(() => {
    log.push(`charge:${amount}`)
    return { id: `ch_${amount}`, amount }
  })

export const sendReceipt = (charge: Charge): Effect.Effect<string> =>
  Effect.sync(() => {
    log.push(`receipt:${charge.id}`)
    return `rc_${charge.id}`
  })

export const checkout = (amount: number): Effect.Effect<string> =>
  Effect.gen(function*() {
    const charge = yield* chargeCard(amount)
    return yield* sendReceipt(charge)
  })
