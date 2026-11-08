import { Layer } from "effect"
import { HttpRouter, HttpServer } from "effect/http"
import { HttpApiBuilder } from "effect/http-api"
import { assert, it } from "tutorial-test"
import { Api, PaymentsHandlers } from "./main"

const { dispose, handler } = HttpRouter.toWebHandler(
  HttpApiBuilder.layer(Api).pipe(
    Layer.provide(PaymentsHandlers),
    Layer.provide(HttpServer.layerServices)
  ),
  { disableLogger: true }
)

const post = (body: unknown) =>
  handler(
    new Request("http://localhost/payments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    })
  )

it("the handler answers with a receipt for the payload", async () => {
  const response = await post({ amount: 5, token: "tok_1" })
  assert.strictEqual(response.status, 200)
  assert.strictEqual(
    await response.text(),
    "{\"id\":\"rc_tok_1\",\"amount\":5}"
  )
})

it("the receipt follows the payload", async () => {
  const response = await post({ amount: 9, token: "tok_2" })
  assert.strictEqual(
    await response.text(),
    "{\"id\":\"rc_tok_2\",\"amount\":9}"
  )
  await dispose()
})
