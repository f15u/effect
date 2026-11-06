import { Effect } from "effect"
import { assert, it } from "tutorial-test"
import { processPayment, reply } from "./main"

export const none: Effect.Effect<Response, never> = reply(
  processPayment("tok_authorized"),
)

const statusOf = (token: Parameters<typeof processPayment>[0]) =>
  Effect.runPromise(reply(processPayment(token))).then(
    (response) => response.status,
    () => {
      throw new Error(`${token} still fails`)
    },
  )

it("an expired card gets 402", async () => {
  assert.strictEqual(await statusOf("tok_expiredcard"), 402)
})

it("an invalid token gets 400", async () => {
  assert.strictEqual(await statusOf("tok_invalid"), 400)
})

it("an unreachable provider gets 503", async () => {
  assert.strictEqual(await statusOf("tok_timeout"), 503)
})
