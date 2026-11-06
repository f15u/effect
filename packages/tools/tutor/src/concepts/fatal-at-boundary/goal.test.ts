import { Cause, Effect, Exit, Result } from "effect"
import { assert, it } from "tutorial-test"
import { ExpiredCardError, reconcile } from "./main"

export const noErrors: Effect.Effect<Response, never> =
  reconcile("tok_authorized")

it("a good payment still succeeds", async () => {
  const response = await Effect.runPromise(reconcile("tok_authorized"))
  assert.strictEqual(response.status, 200)
})

it("a payment error stops the job as a defect", async () => {
  const exit = await Effect.runPromiseExit(reconcile("tok_expiredcard"))
  assert.ok(Exit.isFailure(exit), "the job did not stop")
  const defect = Cause.findDefect(exit.cause)
  assert.ok(Result.isSuccess(defect), "the error is not a defect")
  assert.ok(defect.success instanceof ExpiredCardError, "wrong defect")
})
