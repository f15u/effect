import { Effect } from "effect"

export const spans: Array<string> = []

export const checkout = (amount: number) =>
  Effect.gen(function*() {
    const span = yield* Effect.currentSpan
    spans.push(span.name)
    return amount * 2
  })
