import { Data, Effect } from "effect"

export interface Receipt {
  readonly id: string
}

export class DeclinedError extends Data.TaggedError("DeclinedError") {}

export const receipt: Effect.Effect<Receipt, never> = Effect.succeed({
  id: "receipt_1"
})

export const declined: Effect.Effect<never, DeclinedError> = Effect.fail(
  new DeclinedError()
)
