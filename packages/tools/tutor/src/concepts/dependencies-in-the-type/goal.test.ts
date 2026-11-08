import { Effect } from "effect"
import { assert, it } from "tutorial-test"
import { checkout, Gateway } from "./main"

it("checkout pays through the Gateway that is provided", async () => {
  const result = await Effect.runPromise(
    checkout(5).pipe(
      Effect.provideService(Gateway, {
        charge: (amount) => Effect.succeed({ id: `fake_${amount}`, amount })
      })
    )
  )
  assert.strictEqual(result, "paid fake_5")
})

it("checkout cannot run without a Gateway", () => {
  // @ts-expect-error checkout needs a Gateway
  Effect.runPromise(checkout(5)).catch(() => {})
})
