import { Cause, Effect, Exit, Result } from "effect"
import { assert, it } from "tutorial-test"
import { authorizePayment, NetworkError } from "./main"

it("a good token succeeds", async () => {
  const authorization = await Effect.runPromise(
    authorizePayment("tok_authorized"),
  )
  assert.strictEqual(authorization.id, "pauth_123")
})

it("a rejected Promise fails with a NetworkError", async () => {
  const exit = await Effect.runPromiseExit(authorizePayment("tok_timeout"))
  assert.ok(Exit.isFailure(exit))
  const failure = Cause.findError(exit.cause)
  assert.ok(Result.isSuccess(failure), "the rejection is not a typed error")
  assert.ok(failure.success instanceof NetworkError, "wrong error")
})
