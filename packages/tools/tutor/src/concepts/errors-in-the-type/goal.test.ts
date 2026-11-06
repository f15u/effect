import { Cause, Effect, Exit, Result } from "effect"
import { assert, it } from "tutorial-test"
import {
  type Authorization,
  authorizePayment,
  type ExpiredCardError,
  type InvalidTokenError,
  type NetworkError,
  type PaymentToken,
  processPayment,
} from "./main"

type Known = ExpiredCardError | InvalidTokenError | NetworkError

export const typedAuthorize: (
  token: PaymentToken,
) => Effect.Effect<Authorization, Known> = authorizePayment

export const typedProcess: (
  token: PaymentToken,
) => Effect.Effect<Response, Known> = processPayment

it("a good token succeeds through both functions", async () => {
  const response = await Effect.runPromise(processPayment("tok_authorized"))
  assert.strictEqual(response.status, 200)
})

it("each bad token reaches the caller as a typed error", async () => {
  const expected = [
    ["tok_expiredcard", "ExpiredCardError"],
    ["tok_invalid", "InvalidTokenError"],
    ["tok_timeout", "NetworkError"],
  ] as const
  for (const [token, tag] of expected) {
    const exit = await Effect.runPromiseExit(processPayment(token))
    assert.ok(Exit.isFailure(exit), "the failure is not an Effect failure")
    const failure = Cause.findError(exit.cause)
    assert.ok(Result.isSuccess(failure), "the failure is not a typed error")
    assert.strictEqual(failure.success._tag, tag)
  }
})
