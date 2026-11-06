import { Data, Effect } from "effect"

export type PaymentToken =
  | "tok_authorized"
  | "tok_declined"
  | "tok_expiredcard"
  | "tok_invalid"
  | "tok_timeout"

export interface Authorization {
  readonly id: string
  readonly status: "authorized" | "declined"
}

export class ExpiredCardError extends Data.TaggedError("ExpiredCardError")<{
  readonly last4: string
}> {}

export class InvalidTokenError extends Data.TaggedError("InvalidTokenError") {}

export class NetworkError extends Data.TaggedError("NetworkError") {}

export const authorizePayment = Effect.fn(function* (token: PaymentToken) {
  if (token === "tok_expiredcard") {
    return yield* new ExpiredCardError({ last4: "4242" })
  }

  if (token === "tok_invalid") {
    return yield* new InvalidTokenError()
  }

  if (token === "tok_timeout") {
    return yield* new NetworkError()
  }

  const authorization: Authorization =
    token === "tok_declined"
      ? { id: "pauth_456", status: "declined" }
      : { id: "pauth_123", status: "authorized" }

  return authorization
})
