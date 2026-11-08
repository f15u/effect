import { assert, it } from "tutorial-test"
import { main, runs } from "./main"

it("main gives the value of the program", async () => {
  runs.length = 0
  assert.strictEqual(await main(), "receipt_1")
})

it("main runs the program once per call", async () => {
  runs.length = 0
  await main()
  await main()
  assert.strictEqual(runs.join(","), ["ran", "ran"].join(","))
})
