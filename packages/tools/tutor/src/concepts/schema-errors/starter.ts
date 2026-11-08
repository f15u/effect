import { Data, Effect } from "effect"

export class DeclinedError extends Data.TaggedError("DeclinedError")<{
  readonly reason: string
}> {}

export const charge = (
  amount: number
): Effect.Effect<string, DeclinedError> =>
  amount > 100
    ? Effect.fail(new DeclinedError({ reason: "over the limit" }))
    : Effect.succeed(`paid ${amount}`)
