import { Effect } from "effect"
import { assert, it } from "tutorial-test"
import { receiptText } from "./main"

it("receiptText charges, sends the receipt and formats the id", async () => {
  assert.strictEqual(
    await Effect.runPromise(receiptText(50)),
    "Receipt rc_ch_50"
  )
})

it("receiptText follows the amount", async () => {
  assert.strictEqual(
    await Effect.runPromise(receiptText(7)),
    "Receipt rc_ch_7"
  )
})
