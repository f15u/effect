import * as NodeServices from "@effect/platform-node/NodeServices"
import { it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import type * as Layer from "effect/Layer"
import type * as Scope from "effect/Scope"

export const liveWith = <ROut, E2>(layer: Layer.Layer<ROut, E2>) =>
<A, E>(
  name: string,
  body: Effect.Effect<A, E, ROut | Scope.Scope>,
  timeout?: number
) => it.live(name, () => body.pipe(Effect.provide(layer)), timeout)

export const liveNode = liveWith(NodeServices.layer)
