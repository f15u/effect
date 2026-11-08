import { Effect } from "effect"

export const spans: Array<string> = []

export const checkout = Effect.fn("checkout")(function*(amount: number) {
  const span = yield* Effect.currentSpan
  spans.push(span.name)
  return amount * 2
})
