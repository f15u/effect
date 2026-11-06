import { Cause, Effect, Exit, Result } from "effect"
import { assert, it } from "tutorial-test"
import { type Authorization, capturePayment, DoubleCaptureError } from "./main"

const fresh: Authorization = { id: "pauth_new", status: "authorized" }
const duplicate: Authorization = { id: "pauth_123", status: "authorized" }

export const noExpectedError: Effect.Effect<Authorization, never> =
  capturePayment(fresh)

it("a second capture stops with a defect", async () => {
  const exit = await Effect.runPromiseExit(capturePayment(duplicate))
  assert.ok(Exit.isFailure(exit), "the second capture must stop")
  const defect = Cause.findDefect(exit.cause)
  assert.ok(Result.isSuccess(defect), "the problem is not a defect")
  assert.ok(defect.success instanceof DoubleCaptureError, "wrong defect")
})

it("a second capture is not a typed error", async () => {
  const exit = await Effect.runPromiseExit(capturePayment(duplicate))
  assert.ok(Exit.isFailure(exit))
  assert.ok(
    Result.isFailure(Cause.findError(exit.cause)),
    "the problem is a typed error",
  )
})

it("a first capture succeeds", async () => {
  const result = await Effect.runPromise(capturePayment(fresh))
  assert.strictEqual(result.id, "pauth_new")
})
