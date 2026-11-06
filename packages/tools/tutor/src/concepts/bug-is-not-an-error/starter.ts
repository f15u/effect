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

export class DoubleCaptureError extends Data.TaggedError("DoubleCaptureError")<{
  readonly id: string
}> {}

const captured = new Set(["pauth_123"])

export const capturePayment = Effect.fn(function* (
  authorization: Authorization,
) {
  if (captured.has(authorization.id)) {
    return yield* new DoubleCaptureError({ id: authorization.id })
  }

  captured.add(authorization.id)

  return authorization
})
