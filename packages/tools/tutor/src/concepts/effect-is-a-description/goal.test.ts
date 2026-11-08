import { Effect } from "effect"
import { assert, it } from "tutorial-test"
import { sendReceipt, sent } from "./main"

it("building the Effect sends nothing", () => {
  sent.length = 0
  sendReceipt("a")
  assert.strictEqual(sent.length, 0, "the receipt went out before the Effect ran")
})

it("running the Effect sends the receipt", async () => {
  sent.length = 0
  await Effect.runPromise(sendReceipt("a"))
  assert.strictEqual(sent.join(","), ["a"].join(","))
})

it("running the same Effect twice sends two receipts", async () => {
  sent.length = 0
  const job = sendReceipt("a")
  await Effect.runPromise(job)
  await Effect.runPromise(job)
  assert.strictEqual(sent.join(","), ["a", "a"].join(","))
})
