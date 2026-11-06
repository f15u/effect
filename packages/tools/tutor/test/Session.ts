import * as NodeServices from "@effect/platform-node/NodeServices"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Path from "effect/Path"
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

export const session = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
  const dir = yield* fs.makeTempDirectoryScoped({ prefix: "tutor-" })
  const bin = yield* fs.makeTempDirectoryScoped({ prefix: "tutor-bin-" })
  const installLog = path.join(bin, "installs.log")
  yield* fs.writeFileString(
    path.join(bin, "npm"),
    `#!/bin/sh\necho "$PWD :: $@" >> "${installLog}"\n`,
    { mode: 0o755 },
  )
  const cli = path.resolve(import.meta.dirname, "../src/cli.ts")

  const t = (...args: ReadonlyArray<string>) =>
    Effect.scoped(
      Effect.gen(function* () {
        const handle = yield* spawner.spawn(
          ChildProcess.make("node", ["--no-warnings", cli, ...args], {
            cwd: dir,
            stdin: "ignore",
            env: { PATH: `${bin}:${process.env.PATH}` },
            extendEnv: true,
          }),
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
