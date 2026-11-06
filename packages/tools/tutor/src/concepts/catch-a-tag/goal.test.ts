import { Cause, Effect, Exit, Result } from "effect"
import { assert, it } from "tutorial-test"
import {
  answerExpired,
  InvalidTokenError,
  NetworkError,
  processPayment,
} from "./main"

export const remaining: Effect.Effect<
  Response,
  InvalidTokenError | NetworkError
> = answerExpired(processPayment("tok_expiredcard"))

it("an expired card gets a 402 reply", async () => {
  const response = await Effect.runPromise(
    answerExpired(processPayment("tok_expiredcard")),
  ).catch(() => {
    throw new Error("the ExpiredCardError is not handled")
  })
  assert.strictEqual(response.status, 402)
  assert.strictEqual(await response.text(), "Card expired")
})

it("a good payment is untouched", async () => {
  const response = await Effect.runPromise(
    answerExpired(processPayment("tok_authorized")),
  )
  assert.strictEqual(response.status, 200)
})

it("the other errors still fail", async () => {
  const exit = await Effect.runPromiseExit(
    answerExpired(processPayment("tok_timeout")),
  )
  assert.ok(Exit.isFailure(exit), "the other errors must stay")
  const failure = Cause.findError(exit.cause)
  assert.ok(Result.isSuccess(failure))
  assert.ok(failure.success instanceof NetworkError, "wrong error")
})
