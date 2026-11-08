import { Effect } from "effect"
import { FetchHttpClient } from "effect/http"
import { assert, it } from "tutorial-test"
import { dispose, handler, pay } from "./main"

const toHandler =
  ((input: Request | string | URL, init?: RequestInit) => handler(new Request(input, init))) as typeof fetch

const run = <A, E>(effect: Effect.Effect<A, E>) =>
  Effect.runPromise(effect.pipe(Effect.provideService(FetchHttpClient.Fetch, toHandler)))

it("pay returns the receipt from the server", async () => {
  const receipt = await run(pay(5))
  assert.strictEqual(receipt.id, "rc_tok")
  assert.strictEqual(receipt.amount, 5)
})

it("pay fails with the typed DeclinedError of the contract", async () => {
  const error = await run(Effect.flip(pay(500)))
  assert.strictEqual((error as { _tag: string })._tag, "DeclinedError")
  await dispose()
})
