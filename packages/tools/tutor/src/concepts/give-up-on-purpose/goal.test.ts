import { Cause, Effect, Exit, Result } from "effect"
import { assert, it } from "tutorial-test"
import {
  ExpiredCardError,
  type InvalidTokenError,
  NetworkError,
  reconcile,
  reconcileSelected,
} from "./main"

export const allFatal: Effect.Effect<Response, never> =
  reconcile("tok_authorized")
export const someFatal: Effect.Effect<
  Response,
  InvalidTokenError | NetworkError
> = reconcileSelected("tok_authorized")

const defectOf = async (effect: Effect.Effect<Response, unknown>) => {
  const exit = await Effect.runPromiseExit(effect)
  assert.ok(Exit.isFailure(exit), "the effect must stop")
  const defect = Cause.findDefect(exit.cause)
  assert.ok(Result.isSuccess(defect), "the error is not a defect")
  return defect.success
}

it("reconcile turns every typed error into a defect", async () => {
  assert.ok((await defectOf(reconcile("tok_timeout"))) instanceof NetworkError)
  assert.ok(
    (await defectOf(reconcile("tok_expiredcard"))) instanceof ExpiredCardError,
  )
})

it("reconcileSelected turns only an expired card into a defect", async () => {
  assert.ok(
    (await defectOf(reconcileSelected("tok_expiredcard"))) instanceof
      ExpiredCardError,
  )
})

it("reconcileSelected keeps the other errors typed", async () => {
  const exit = await Effect.runPromiseExit(reconcileSelected("tok_timeout"))
  assert.ok(Exit.isFailure(exit))
  const failure = Cause.findError(exit.cause)
  assert.ok(Result.isSuccess(failure), "the network error became a defect")
  assert.ok(failure.success instanceof NetworkError, "wrong error")
})

it("a good payment passes", async () => {
  const response = await Effect.runPromise(reconcile("tok_authorized"))
  assert.strictEqual(response.status, 200)
})
