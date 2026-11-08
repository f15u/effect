import { Cause, Effect, Exit, Result } from "effect"
import { assert, it } from "tutorial-test"
import { readPayment } from "./main"

it("a correct input gives a payment", async () => {
  const payment = await Effect.runPromise(
    readPayment({ amount: 5, token: "tok_1" })
  )
  assert.strictEqual(payment.amount, 5)
})

it("a bad input fails with a typed SchemaError", async () => {
  const exit = await Effect.runPromiseExit(
    readPayment({ amount: "5", token: "tok_1" })
  )
  assert.ok(Exit.isFailure(exit), "the bad input was accepted")
  const failure = Cause.findError(exit.cause)
  assert.ok(Result.isSuccess(failure), "the failure is not a typed error")
  assert.strictEqual(failure.success._tag, "SchemaError")
})
