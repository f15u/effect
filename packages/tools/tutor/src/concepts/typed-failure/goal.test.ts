import { Cause, Effect, Exit, Result } from "effect"
import { assert, it } from "tutorial-test"
import {
  type Authorization,
  authorizePayment,
  ExpiredCardError,
  InvalidTokenError,
  NetworkError,
  type PaymentToken,
} from "./main"

type Known = ExpiredCardError | InvalidTokenError | NetworkError

export const typed: (
  token: PaymentToken,
) => Effect.Effect<Authorization, Known> = authorizePayment

it("a good token succeeds", async () => {
  const authorization = await Effect.runPromise(
    authorizePayment("tok_authorized"),
  )
  assert.strictEqual(authorization.id, "pauth_123")
})

it("each bad token fails with its own error", async () => {
  const expected = [
    ["tok_expiredcard", ExpiredCardError],
    ["tok_invalid", InvalidTokenError],
    ["tok_timeout", NetworkError],
  ] as const
  for (const [token, error] of expected) {
    const exit = await Effect.runPromiseExit(authorizePayment(token))
    assert.ok(Exit.isFailure(exit), "the failure is not an Effect failure")
    const failure = Cause.findError(exit.cause)
    assert.ok(Result.isSuccess(failure), "the failure is not a typed error")
    assert.ok(failure.success instanceof error, "wrong error")
  }
})
