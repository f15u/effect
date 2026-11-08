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

export const authorizePayment = async (
  token: PaymentToken
): Promise<Authorization> => {
  if (token === "tok_expiredcard") {
    throw new ExpiredCardError()
  }

  if (token === "tok_invalid") {
    throw new InvalidTokenError()
  }

  if (token === "tok_timeout") {
    throw new NetworkError()
  }

  return token === "tok_declined"
    ? { id: "pauth_456", status: "declined" }
    : { id: "pauth_123", status: "authorized" }
}

export const processPayment = async (
  token: PaymentToken
): Promise<Response> => {
  try {
    const authorization = await authorizePayment(token)
    return Response.json(authorization)
  } catch (error) {
    if (error instanceof ExpiredCardError) {
      return new Response("Card expired", { status: 402 })
    }

    if (error instanceof InvalidTokenError) {
      return new Response("Invalid payment token", { status: 400 })
    }

    if (error instanceof NetworkError) {
      return new Response("Payment provider unavailable", { status: 503 })
    }

    throw error
  }
}
