import { Effect, Schema } from "effect"
import { assert, it } from "tutorial-test"
import { charge, DeclinedError } from "./main"

it("the error is still a tagged failure", async () => {
  const result = await Effect.runPromise(
    charge(500).pipe(
      Effect.catchTag("DeclinedError", (error) => Effect.succeed(error.reason))
    )
  )
  assert.strictEqual(result, "over the limit")
})

it("the error encodes to a plain object", () => {
  const wire = Schema.encodeSync(DeclinedError)(
    new DeclinedError({ reason: "no funds" })
  )
  assert.strictEqual(JSON.stringify(wire), "{\"_tag\":\"DeclinedError\",\"reason\":\"no funds\"}")
})

it("a client copy decodes back into the error class", () => {
  const error = Schema.decodeUnknownSync(DeclinedError)({
    _tag: "DeclinedError",
    reason: "no funds"
  })
  assert.ok(error instanceof DeclinedError, "the copy is not a DeclinedError")
  assert.strictEqual(error.reason, "no funds")
})
