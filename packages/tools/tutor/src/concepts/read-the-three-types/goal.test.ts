import { Effect, Exit } from "effect"
import { assert, it } from "tutorial-test"
import { declined, type DeclinedError, type Receipt, receipt } from "./main"

export const typedReceipt: Effect.Effect<Receipt, never> = receipt

export const typedDeclined: Effect.Effect<never, DeclinedError> = declined

it("receipt succeeds with a receipt", async () => {
  assert.strictEqual((await Effect.runPromise(receipt)).id, "receipt_1")
})

it("declined fails", async () => {
  const exit = await Effect.runPromiseExit(declined)
  assert.ok(Exit.isFailure(exit))
})
