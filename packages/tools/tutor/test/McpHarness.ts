import * as Deferred from "effect/Deferred"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Queue from "effect/Queue"
import * as Schema from "effect/Schema"
import * as Sink from "effect/Sink"
import * as Stdio from "effect/Stdio"
import * as Stream from "effect/Stream"
import { McpLive } from "../src/mcp.ts"
import { State } from "../src/Progress.ts"
import { clean, world, type Content, type InstallResult } from "./Harness.ts"

const Property = Schema.Struct({
  enum: Schema.optionalKey(Schema.Array(Schema.String)),
  default: Schema.optionalKey(Schema.Unknown),
})

const Message = Schema.Struct({
  id: Schema.optionalKey(Schema.Number),
  method: Schema.optionalKey(Schema.String),
  params: Schema.optionalKey(Schema.Unknown),
  result: Schema.optionalKey(Schema.Unknown),
})
type Message = typeof Message.Type

const ElicitParams = Schema.Struct({
  message: Schema.String,
  requestedSchema: Schema.Struct({
    properties: Schema.Record(Schema.String, Property),
  }),
})

export interface ElicitRequest {
  readonly message: string
  readonly properties: Readonly<Record<string, typeof Property.Type>>
}

const ToolResult = Schema.Struct({
  content: Schema.Array(Schema.Struct({ text: Schema.String })),
  isError: Schema.optionalKey(Schema.Boolean),
})

const ToolList = Schema.Struct({
  tools: Schema.Array(
    Schema.Struct({
      name: Schema.String,
      description: Schema.optionalKey(Schema.String),
    }),
  ),
})

const Initialized = Schema.Struct({ instructions: Schema.String })

const decode = <S extends Schema.Decoder<unknown>>(schema: S) =>
  Schema.decodeUnknownEffect(schema)

export type ElicitAnswer =
  | { readonly action: "accept"; readonly content: Record<string, unknown> }
  | { readonly action: "decline" }

export interface McpOptions {
  readonly capabilities?: Record<string, unknown>
  readonly answer?: (request: ElicitRequest) => ElicitAnswer
  readonly install?: InstallResult | "missing"
}

export const mcpSession = (options: Content & McpOptions) =>
  Effect.gen(function* () {
    const w = yield* world(options)
    const asked: Array<ElicitRequest> = []
    const inbox = yield* Queue.unbounded<Uint8Array>()
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()
    const pending = new Map<number, Deferred.Deferred<Message>>()
    let nextId = 1
    let buffered = ""

    const send = (message: unknown) =>
      Queue.offer(inbox, encoder.encode(`${JSON.stringify(message)}\n`))

    const receive = (line: string) =>
      Effect.gen(function* () {
        if (line.trim() === "") return
        const message = yield* decode(Schema.fromJsonString(Message))(line)
        if (message.method === "elicitation/create") {
          const params = yield* decode(ElicitParams)(message.params)
          const request: ElicitRequest = {
            message: params.message,
            properties: params.requestedSchema.properties,
          }
          asked.push(request)
          const answer = options.answer?.(request) ?? { action: "decline" }
          yield* send({ jsonrpc: "2.0", id: message.id, result: answer })
          return
        }
        if (message.id === undefined) return
        const waiting = pending.get(message.id)
        if (waiting === undefined) return
        pending.delete(message.id)
        yield* Deferred.succeed(waiting, message)
      }).pipe(Effect.orDie)

    const StdioLive = Stdio.layerTest({
      stdin: Stream.fromQueue(inbox),
      stdout: () =>
        Sink.forEach((chunk: string | Uint8Array) =>
          Effect.suspend(() => {
            buffered +=
              typeof chunk === "string" ? chunk : decoder.decode(chunk)
            const parts = buffered.split("\n")
            buffered = parts.pop() ?? ""
            return Effect.forEach(parts, receive, { discard: true })
          }),
        ),
    })

    const ready = yield* Deferred.make<void>()
    yield* Effect.gen(function* () {
      yield* Layer.build(
        McpLive.pipe(Layer.provide(StdioLive), Layer.provide(w.Environment)),
      )
      yield* Deferred.succeed(ready, undefined)
      return yield* Effect.never
    }).pipe(Effect.scoped, Effect.forkScoped)
    yield* Deferred.await(ready)

    const call = (method: string, params: unknown) =>
      Effect.gen(function* () {
        const id = nextId++
        const deferred = yield* Deferred.make<Message>()
        pending.set(id, deferred)
        yield* send({ jsonrpc: "2.0", id, method, params })
        return yield* Deferred.await(deferred)
      })

    const init = yield* call("initialize", {
      protocolVersion: "2025-11-25",
      capabilities: options.capabilities ?? {},
      clientInfo: { name: "test", version: "0" },
    }).pipe(
      Effect.flatMap((reply) => decode(Initialized)(reply.result)),
      Effect.orDie,
    )
    yield* send({ jsonrpc: "2.0", method: "notifications/initialized" })

    const tool = (name: string, args: Record<string, unknown> = {}) =>
      call("tools/call", { name, arguments: args }).pipe(
        Effect.flatMap((reply) => decode(ToolResult)(reply.result)),
        Effect.orDie,
        Effect.map((result) => ({
          out: result.content[0]!.text,
          isError: result.isError === true,
        })),
        Effect.tap((result) => clean(result.out)),
      )

    const rawTools = call("tools/list", {}).pipe(
      Effect.flatMap((reply) => decode(ToolList)(reply.result)),
      Effect.orDie,
      Effect.map((list) => list.tools),
    )

    const tools = rawTools.pipe(
      Effect.map((list) => list.map((item) => item.name)),
    )

    const state = w
      .read(".effect-tutor.json")
      .pipe(Effect.flatMap(decode(Schema.fromJsonString(State))), Effect.orDie)

    return {
      state,
      init,
      tool,
      tools,
      rawTools,
      files: w.files,
      nested: w.nested,
      read: w.read,
      write: w.write,
      asked,
      installs: w.installs,
    }
  })
