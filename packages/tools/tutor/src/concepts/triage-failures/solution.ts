import { Data, Effect } from "effect"

export class ExpiredCardError extends Data.TaggedError("ExpiredCardError") {}

export class NetworkError extends Data.TaggedError("NetworkError") {}

export type Status = "authorized" | "declined"

// The caller shows "Card expired" to the customer.
export const checkExpiry = (expired: boolean) => expired ? Effect.fail(new ExpiredCardError()) : Effect.void

// An unknown status is a bug in the provider contract.
export const readStatus = (raw: string) =>
  raw === "authorized" || raw === "declined"
    ? Effect.succeed<Status>(raw)
    : Effect.die(new Error("unknown status"))

// This caller must reply 503 when the provider is unreachable.
export const answerTimeout = (self: Effect.Effect<Response, NetworkError>) =>
  self.pipe(
    Effect.catchTag("NetworkError", () =>
      Effect.succeed(
        new Response("Payment provider unavailable", { status: 503 })
      ))
  )

// A declined card is a normal result.
export const describe = (status: Status) => Effect.succeed(status === "declined" ? "Declined" : "Paid")
