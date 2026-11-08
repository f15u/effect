import { OpenApi } from "effect/http-api"
import { assert, it } from "tutorial-test"
import { Api } from "./main"

const spec = JSON.parse(JSON.stringify(OpenApi.fromApi(Api)))

it("the contract has a POST /payments endpoint", () => {
  assert.ok(spec.paths["/payments"]?.post, "there is no POST /payments")
})

it("the endpoint describes its request body", () => {
  assert.ok(
    spec.paths["/payments"]?.post?.requestBody,
    "the endpoint has no payload"
  )
})

it("the endpoint describes its success reply", () => {
  assert.ok(
    spec.paths["/payments"]?.post?.responses?.["200"],
    "the endpoint has no success reply"
  )
})
