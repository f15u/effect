import { Effect, Layer } from "effect"
import { HttpRouter, HttpServer } from "effect/http"
import { HttpApiBuilder } from "effect/http-api"
import { assert, it } from "tutorial-test"
import { Api, dispose, Gateway, handler, PaymentsHandlers } from "./main"

const request = (body: unknown) =>
  new Request("http://localhost/payments", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  })

const fake = Layer.succeed(Gateway, {
  charge: (amount) => Effect.succeed({ id: "fake", amount })
})

const fakeServer = HttpRouter.toWebHandler(
  HttpApiBuilder.layer(Api).pipe(
    Layer.provide(PaymentsHandlers.pipe(Layer.provide(fake))),
    Layer.provide(HttpServer.layerServices)
  ),
  { disableLogger: true }
)

it("a correct payment gets a 200 receipt from the real gateway", async () => {
  const response = await handler(request({ amount: 5, token: "tok_1" }))
  assert.strictEqual(response.status, 200)
  assert.strictEqual(await response.text(), "{\"id\":\"ch_5\",\"amount\":5}")
})

it("a declined payment gets a 402 with the encoded error", async () => {
  const response = await handler(request({ amount: 500, token: "tok_1" }))
  assert.strictEqual(response.status, 402)
  assert.strictEqual(
    await response.text(),
    "{\"_tag\":\"DeclinedError\",\"reason\":\"over the limit\"}"
  )
})

it("a payload that breaks a rule of the Schema gets a 400", async () => {
  assert.strictEqual(
    (await handler(request({ amount: 0, token: "tok_1" }))).status,
    400
  )
  assert.strictEqual(
    (await handler(request({ amount: "5", token: "tok_1" }))).status,
    400
  )
})

it("the handlers use the Gateway that the server provides", async () => {
  const response = await fakeServer.handler(request({ amount: 5, token: "tok_1" }))
  assert.strictEqual(await response.text(), "{\"id\":\"fake\",\"amount\":5}")
  await fakeServer.dispose()
  await dispose()
})
