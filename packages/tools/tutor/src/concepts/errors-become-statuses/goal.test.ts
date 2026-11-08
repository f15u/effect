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

it("a payment under the limit still gets a 200 receipt", async () => {
  const response = await post({ amount: 5, token: "tok_1" })
  assert.strictEqual(response.status, 200)
})

it("a payment over the limit gets the status 402", async () => {
  const response = await post({ amount: 500, token: "tok_1" })
  assert.strictEqual(response.status, 402)
})

it("the 402 body is the encoded error", async () => {
  const response = await post({ amount: 500, token: "tok_1" })
  assert.strictEqual(
    await response.text(),
    "{\"_tag\":\"DeclinedError\",\"reason\":\"over the limit\"}"
  )
  await dispose()
})
