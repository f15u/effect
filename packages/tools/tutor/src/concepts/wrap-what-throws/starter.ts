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

export class NetworkError extends Data.TaggedError("NetworkError") {}

const providerAuthorize = async (
  token: PaymentToken,
): Promise<Authorization> => {
  if (token === "tok_timeout") {
    throw new Error("ETIMEDOUT")
  }

  return token === "tok_declined"
    ? { id: "pauth_456", status: "declined" }
    : { id: "pauth_123", status: "authorized" }
}

export const authorizePayment = (
  token: PaymentToken,
): Effect.Effect<Authorization, NetworkError> =>
  Effect.promise(() => providerAuthorize(token))
