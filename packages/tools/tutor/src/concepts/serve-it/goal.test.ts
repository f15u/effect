import { assert, it } from "tutorial-test"
import { dispose, handler } from "./main"

const post = (body: unknown) =>
  handler(
    new Request("http://localhost/payments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    })
  )

it("a correct payment gets a 200 receipt", async () => {
  const response = await post({ amount: 5, token: "tok_1" })
  assert.strictEqual(response.status, 200)
  assert.strictEqual(
    await response.text(),
    "{\"id\":\"rc_tok_1\",\"amount\":5}"
  )
})

it("a declined payment gets a 402", async () => {
  const response = await post({ amount: 500, token: "tok_1" })
  assert.strictEqual(response.status, 402)
})

it("a payload with the wrong type gets a 400", async () => {
  const response = await post({ amount: "5", token: "tok_1" })
  assert.strictEqual(response.status, 400)
  await dispose()
})
