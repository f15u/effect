import { Cause, Effect, Exit, Result } from "effect"
import { assert, it } from "tutorial-test"
import { answerTimeout, checkExpiry, describe, ExpiredCardError, NetworkError, readStatus } from "./main"

export const expiryType: Effect.Effect<void, ExpiredCardError> = checkExpiry(true)
export const statusType: Effect.Effect<"authorized" | "declined", never> = readStatus("authorized")
export const timeoutType: Effect.Effect<Response, never> = answerTimeout(
  Effect.fail(new NetworkError())
)
export const describeType: Effect.Effect<string, never> = describe("declined")

it("an expired card is a typed error", async () => {
  const exit = await Effect.runPromiseExit(checkExpiry(true))
  assert.ok(Exit.isFailure(exit))
  const failure = Cause.findError(exit.cause)
  assert.ok(Result.isSuccess(failure), "an expired card is not a typed error")
  assert.ok(failure.success instanceof ExpiredCardError, "wrong error")
})

it("an unknown status is a defect", async () => {
  const exit = await Effect.runPromiseExit(readStatus("refunded"))
  assert.ok(Exit.isFailure(exit))
  assert.ok(
    Result.isSuccess(Cause.findDefect(exit.cause)),
    "an unknown status is not a defect"
  )
})

it("a known status is a value", async () => {
  assert.strictEqual(
    await Effect.runPromise(readStatus("declined")),
    "declined"
  )
})

it("a provider timeout gets a 503 reply", async () => {
  const response = await Effect.runPromise(
    answerTimeout(Effect.fail(new NetworkError()))
  )
  assert.strictEqual(response.status, 503)
})

it("a declined card is a normal result", async () => {
  assert.strictEqual(await Effect.runPromise(describe("declined")), "Declined")
  assert.strictEqual(await Effect.runPromise(describe("authorized")), "Paid")
})
