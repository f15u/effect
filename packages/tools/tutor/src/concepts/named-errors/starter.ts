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

export class ExpiredCardError extends Error {}

export class InvalidTokenError extends Error {}

export class NetworkError extends Error {}

export const authorizePayment = Effect.fn(function* (token: PaymentToken) {
  if (token === "tok_expiredcard") {
    return yield* Effect.fail(new ExpiredCardError())
  }

  if (token === "tok_invalid") {
    return yield* Effect.fail(new InvalidTokenError())
  }

  if (token === "tok_timeout") {
    return yield* Effect.fail(new NetworkError())
  }

  const authorization: Authorization =
    token === "tok_declined"
      ? { id: "pauth_456", status: "declined" }
      : { id: "pauth_123", status: "authorized" }

  return authorization
})
