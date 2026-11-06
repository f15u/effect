import { Cause, Effect, Exit, Result } from "effect"
import { assert, it } from "tutorial-test"
import { authorizePayment } from "./main"

const failureOf = async (token: Parameters<typeof authorizePayment>[0]) => {
  const exit = await Effect.runPromiseExit(authorizePayment(token))
  assert.ok(Exit.isFailure(exit), "the payment must fail")
  const failure = Cause.findError(exit.cause)
  assert.ok(Result.isSuccess(failure), "the failure is not a typed error")
  return failure.success
}

it("each error has a tag with its own name", async () => {
  assert.strictEqual(
    (await failureOf("tok_expiredcard"))._tag,
    "ExpiredCardError",
  )
  assert.strictEqual((await failureOf("tok_invalid"))._tag, "InvalidTokenError")
  assert.strictEqual((await failureOf("tok_timeout"))._tag, "NetworkError")
})

it("an expired card carries its last four digits", async () => {
  const error = await failureOf("tok_expiredcard")
  if (error._tag === "ExpiredCardError") {
    assert.strictEqual(error.last4, "4242")
  } else {
    assert.fail("wrong error")
  }
})
