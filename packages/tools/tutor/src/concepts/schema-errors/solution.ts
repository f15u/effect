import { Effect, Schema } from "effect"

export class DeclinedError extends Schema.TaggedError<DeclinedError>()(
  "DeclinedError",
  { reason: Schema.String }
) {}

export const charge = (
  amount: number
): Effect.Effect<string, DeclinedError> =>
  amount > 100
    ? Effect.fail(new DeclinedError({ reason: "over the limit" }))
    : Effect.succeed(`paid ${amount}`)
