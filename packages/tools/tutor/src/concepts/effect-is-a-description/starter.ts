import { Effect } from "effect"

export const sent: Array<string> = []

export const sendReceipt = (id: string): Effect.Effect<void> => {
  sent.push(id)
  return Effect.void
}
