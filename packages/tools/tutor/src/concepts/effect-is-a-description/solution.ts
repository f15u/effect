import { Effect } from "effect"

export const sent: Array<string> = []

export const sendReceipt = (id: string): Effect.Effect<void> =>
  Effect.sync(() => {
    sent.push(id)
  })
