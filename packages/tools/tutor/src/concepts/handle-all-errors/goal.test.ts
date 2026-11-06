import { Effect } from "effect"
import { assert, it } from "tutorial-test"
import { answerAll, processPayment } from "./main"

export const handled: Effect.Effect<Response, never> = answerAll(
  processPayment("tok_authorized"),
)

const status = (token: Parameters<typeof processPayment>[0]) =>
  Effect.runPromise(answerAll(processPayment(token))).then(
    (response) => response.status,
  )

it("each error gets its own reply", async () => {
  assert.strictEqual(await status("tok_expiredcard"), 402)
  assert.strictEqual(await status("tok_invalid"), 400)
  assert.strictEqual(await status("tok_timeout"), 503)
})

it("a good payment is untouched", async () => {
  assert.strictEqual(await status("tok_authorized"), 200)
})
