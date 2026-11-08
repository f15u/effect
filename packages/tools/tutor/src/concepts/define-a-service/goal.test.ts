import { Effect } from "effect"
import { assert, it } from "tutorial-test"
import { Gateway } from "./main"

const program = Effect.gen(function*() {
  const gateway = yield* Gateway
  const charge = yield* gateway.charge(5)
  return charge.id
})

it("a program can get the Gateway and use it", async () => {
  const result = await Effect.runPromise(
    program.pipe(
      Effect.provideService(Gateway, {
        charge: (amount) => Effect.succeed({ id: `fake_${amount}`, amount })
      })
    )
  )
  assert.strictEqual(result, "fake_5")
})
