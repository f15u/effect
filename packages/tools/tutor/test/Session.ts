import * as NodeServices from "@effect/platform-node/NodeServices"
import * as Deferred from "effect/Deferred"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Path from "effect/Path"
import * as Queue from "effect/Queue"
import * as Stream from "effect/Stream"
import * as ChildProcess from "effect/process/ChildProcess"
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner"

export const TestLayer = NodeServices.layer

const phaseNames =
  /ChoosingMode|\bMenu\b|\bProbing\b|\bWorking\b|ProjectWork|Retelling|\bOffering\b|\bFinished\b/

const clean = <A extends { readonly out: string }>(result: A) =>
  result.out.includes("[object Object]")
    ? Effect.die(new Error(`[object Object] in output:\n${result.out}`))
    : phaseNames.test(result.out)
      ? Effect.die(new Error(`phase name in output:\n${result.out}`))
      : Effect.succeed(result)

export const session = (options: { readonly npm?: boolean } = {}) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
    const dir = yield* fs.makeTempDirectoryScoped({ prefix: "tutor-" })
    const bin = yield* fs.makeTempDirectoryScoped({ prefix: "tutor-bin-" })
    const installLog = path.join(bin, "installs.log")
    if (options.npm === false) {
      yield* fs.symlink(process.execPath, path.join(bin, "node"))
    } else {
      yield* fs.writeFileString(
        path.join(bin, "npm"),
        `#!/bin/sh\necho "$PWD :: $@" >> "${installLog}"\n`,
        { mode: 0o755 },
      )
    }
    const cli = path.resolve(import.meta.dirname, "../src/cli.ts")

    const t = (...args: ReadonlyArray<string>) =>
      Effect.scoped(
        Effect.gen(function* () {
          const handle = yield* spawner.spawn(
            ChildProcess.make(
              process.execPath,
              ["--no-warnings", cli, ...args],
              {
                cwd: dir,
                stdin: "ignore",
                env: {
                  PATH:
                    options.npm === false ? bin : `${bin}:${process.env.PATH}`,
                },
                extendEnv: true,
              },
            ),
          )
          const [stdout, stderr, code] = yield* Effect.all(
            [
              handle.stdout.pipe(Stream.decodeText(), Stream.mkString),
              handle.stderr.pipe(Stream.decodeText(), Stream.mkString),
              handle.exitCode,
            ],
            { concurrency: "unbounded" },
          )
          return { out: stdout + stderr, code: Number(code) }
        }),
      ).pipe(Effect.orDie, Effect.flatMap(clean))

    const files = fs.readDirectory(dir)
    const nested = (sub: string) =>
      fs
        .readDirectory(path.join(dir, sub))
        .pipe(Effect.map((names) => names.sort()))

    const read = (file: string) => fs.readFileString(path.join(dir, file))

    const write = (file: string, content: string) =>
      fs
        .makeDirectory(path.dirname(path.join(dir, file)), { recursive: true })
        .pipe(Effect.andThen(fs.writeFileString(path.join(dir, file), content)))

    const installs = fs
      .readFileString(installLog)
      .pipe(Effect.orElseSucceed(() => ""))

    return { dir, t, files, nested, read, write, installs }
  })

export interface ElicitRequest {
  readonly message: string
  readonly properties: Record<string, any>
}

export type ElicitAnswer =
  | { readonly action: "accept"; readonly content: Record<string, unknown> }
  | { readonly action: "decline" }

export const mcpSession = (
  options: {
    readonly capabilities?: Record<string, unknown>
    readonly answer?: (request: ElicitRequest) => ElicitAnswer
  } = {},
) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
    const dir = yield* fs.makeTempDirectoryScoped({ prefix: "tutor-mcp-" })
    const bin = yield* fs.makeTempDirectoryScoped({ prefix: "tutor-bin-" })
    const installLog = path.join(bin, "installs.log")
    yield* fs.writeFileString(
      path.join(bin, "npm"),
      `#!/bin/sh\necho "$PWD :: $@" >> "${installLog}"\n`,
      { mode: 0o755 },
    )
    const cli = path.resolve(import.meta.dirname, "../src/cli.ts")
    const asked: Array<ElicitRequest> = []
    const inbox = yield* Queue.unbounded<Uint8Array>()
    const encoder = new TextEncoder()
    const pending = new Map<number, Deferred.Deferred<any>>()
    let nextId = 1

    const send = (message: unknown) =>
      Queue.offer(inbox, encoder.encode(`${JSON.stringify(message)}\n`))

    const handle = yield* spawner.spawn(
      ChildProcess.make(process.execPath, ["--no-warnings", cli, "mcp"], {
        cwd: dir,
        stdin: Stream.fromQueue(inbox),
        env: { PATH: `${bin}:${process.env.PATH}` },
        extendEnv: true,
      }),
    )

    yield* handle.stdout.pipe(
      Stream.decodeText(),
      Stream.splitLines,
      Stream.runForEach((line) =>
        Effect.gen(function* () {
          if (line.trim() === "") return
          const message = JSON.parse(line)
          if (message.method === "elicitation/create") {
            const request = {
              message: message.params.message as string,
              properties: message.params.requestedSchema.properties,
            }
            asked.push(request)
            const answer = options.answer?.(request) ?? { action: "decline" }
            yield* send({
              jsonrpc: "2.0",
              id: message.id,
              result: answer,
            })
            return
          }
          const waiting = pending.get(message.id)
          if (waiting === undefined) return
          pending.delete(message.id)
          yield* Deferred.succeed(waiting, message)
        }),
      ),
      Effect.forkScoped,
    )

    const call = (method: string, params: unknown) =>
      Effect.gen(function* () {
        const id = nextId++
        const deferred = yield* Deferred.make<any>()
        pending.set(id, deferred)
        yield* send({ jsonrpc: "2.0", id, method, params })
        return yield* Deferred.await(deferred)
      })

    const init = yield* call("initialize", {
      protocolVersion: "2025-11-25",
      capabilities: options.capabilities ?? {},
      clientInfo: { name: "test", version: "0" },
    })
    yield* send({ jsonrpc: "2.0", method: "notifications/initialized" })

    const tool = (name: string, args: Record<string, unknown> = {}) =>
      call("tools/call", { name, arguments: args }).pipe(
        Effect.map((response) => ({
          out: response.result.content[0].text as string,
          isError: response.result.isError === true,
        })),
        Effect.flatMap(clean),
      )

    const tools = call("tools/list", {}).pipe(
      Effect.map((response) =>
        response.result.tools.map((item: any) => item.name as string),
      ),
    )

    const files = fs.readDirectory(dir)
    const nested = (sub: string) =>
      fs
        .readDirectory(path.join(dir, sub))
        .pipe(Effect.map((names) => names.sort()))
    const read = (file: string) => fs.readFileString(path.join(dir, file))
    const write = (file: string, content: string) =>
      fs
        .makeDirectory(path.dirname(path.join(dir, file)), { recursive: true })
        .pipe(Effect.andThen(fs.writeFileString(path.join(dir, file), content)))

    const installs = fs
      .readFileString(installLog)
      .pipe(Effect.orElseSucceed(() => ""))

    return {
      dir,
      init,
      tool,
      tools,
      files,
      nested,
      read,
      write,
      asked,
      installs,
    }
  })
