import { Cause, Effect, Exit, Result } from "effect"
import { assert, it } from "tutorial-test"
import { type Authorization, capturePayment, DoubleCaptureError } from "./main"

export const noErrors: Effect.Effect<Authorization, never> = capturePayment({
  id: "pauth_1",
  status: "authorized",
})

it("a first capture succeeds", async () => {
  const authorization = await Effect.runPromise(
    capturePayment({ id: "pauth_new", status: "authorized" }),
  )
  assert.strictEqual(authorization.id, "pauth_new")
})

it("a second capture stops with a defect", async () => {
  const exit = await Effect.runPromiseExit(
    capturePayment({ id: "pauth_123", status: "authorized" }),
  )
  assert.ok(Exit.isFailure(exit), "the second capture did not stop")
  const defect = Cause.findDefect(exit.cause)
  assert.ok(Result.isSuccess(defect), "the second capture is not a defect")
  assert.ok(defect.success instanceof DoubleCaptureError, "wrong defect")
})
