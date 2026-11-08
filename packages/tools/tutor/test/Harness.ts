import * as ByteSize from "effect/ByteSize"
import * as CliConfig from "effect/cli/CliConfig"
import * as Command from "effect/cli/Command"
import * as GlobalFlag from "effect/cli/GlobalFlag"
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Path from "effect/Path"
import * as PlatformError from "effect/PlatformError"
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner"
import * as Ref from "effect/Ref"
import * as Stdio from "effect/Stdio"
import * as Terminal from "effect/Terminal"
import { Checker } from "../src/Checker.ts"
import type { Concept } from "../src/Concept.ts"
import { Concepts, Curriculum } from "../src/Curriculum.ts"
import { Process } from "../src/Process.ts"
import { learn as command } from "../src/Program.ts"
import { Progress } from "../src/Progress.ts"
import { TutorError } from "../src/TutorError.ts"

const phaseNames = /ChoosingMode|\bMenu\b|\bProbing\b|\bWorking\b|ProjectWork|\bOffering\b|\bFinished\b|Replaying/

const bannedWords = /retell|payoff/i

export const clean = (out: string) =>
  out.includes("[object Object]")
    ? Effect.die(new Error(`[object Object] in output:\n${out}`))
    : bannedWords.test(out)
    ? Effect.die(new Error(`banned word in output:\n${out}`))
    : phaseNames.test(out)
    ? Effect.die(new Error(`phase name in output:\n${out}`))
    : Effect.void

export interface InstallResult {
  readonly exitCode: number
  readonly stderr: string
}

export interface Content {
  readonly concepts: ReadonlyArray<Concept>
  readonly files: Readonly<Record<string, string>>
  readonly passes: (source: string) => boolean
}

export interface WorldOptions extends Content {
  readonly install?: InstallResult | "missing"
}

const missing = (method: string, file: string) =>
  PlatformError.systemError({
    _tag: "NotFound",
    module: "FileSystem",
    method,
    pathOrDescriptor: file
  })

const info = (
  type: "File" | "Directory",
  size: number
): FileSystem.File.Info => ({
  type,
  mtime: Option.none(),
  atime: Option.none(),
  birthtime: Option.none(),
  dev: 0,
  ino: Option.none(),
  mode: 0,
  nlink: Option.none(),
  uid: Option.none(),
  gid: Option.none(),
  rdev: Option.none(),
  size: ByteSize.bytes(size),
  blksize: Option.none(),
  blocks: Option.none()
})

const TerminalStub = Layer.succeed(
  Terminal.Terminal,
  Terminal.make({
    columns: Effect.succeed(80),
    rows: Effect.succeed(24),
    readInput: Effect.die("the tests have no terminal input"),
    readLine: Effect.die("the tests have no terminal input"),
    display: () => Effect.void
  })
)

const SpawnerStub = Layer.succeed(
  ChildProcessSpawner.ChildProcessSpawner,
  ChildProcessSpawner.make(() => Effect.die("the tests start no process"))
)

export const world = (options: WorldOptions) =>
  Effect.gen(function*() {
    const path = yield* Path.Path
    const disk = yield* Ref.make<ReadonlyMap<string, string>>(
      new Map(Object.entries(options.files))
    )
    const installLog = yield* Ref.make<ReadonlyArray<string>>([])
    const key = (file: string) => path.resolve(file)

    const hasChildren = (map: ReadonlyMap<string, string>, dir: string) =>
      Array.from(map.keys()).some((each) => each.startsWith(`${dir}/`))

    const put = (file: string, text: string) => Ref.update(disk, (map) => new Map(map).set(key(file), text))

    const MemoryFs = FileSystem.layerNoop({
      exists: (file) =>
        Ref.get(disk).pipe(
          Effect.map(
            (map) => map.has(key(file)) || hasChildren(map, key(file))
          )
        ),
      readFileString: (file) =>
        Ref.get(disk).pipe(
          Effect.flatMap((map) => {
            const text = map.get(key(file))
            return text === undefined
              ? Effect.fail(missing("readFileString", file))
              : Effect.succeed(text)
          })
        ),
      writeFileString: put,
      makeDirectory: () => Effect.void,
      stat: (file) =>
        Ref.get(disk).pipe(
          Effect.flatMap((map) => {
            const text = map.get(key(file))
            return text !== undefined
              ? Effect.succeed(info("File", text.length))
              : hasChildren(map, key(file))
              ? Effect.succeed(info("Directory", 0))
              : Effect.fail(missing("stat", file))
          })
        )
    })

    const ProcessStub = Layer.succeed(
      Process,
      Process.of({
        execute: (_command, args, cwd) =>
          options.install === "missing"
            ? Effect.fail(
              new TutorError({
                reason: "MissingCommand",
                message: "npm was not found."
              })
            )
            : Ref.update(installLog, (log) => [
              ...log,
              `${cwd} :: ${args.join(" ")}\n`
            ]).pipe(
              Effect.as({
                stdout: "",
                stderr: options.install?.stderr ?? "",
                exitCode: options.install?.exitCode ?? 0
              })
            )
      })
    )

    const Platform = Layer.mergeAll(
      MemoryFs,
      Path.layer,
      Stdio.layerTest({}),
      TerminalStub,
      SpawnerStub
    )

    const CheckerStub = Layer.succeed(
      Checker,
      Checker.of({
        run: (_test, source) =>
          Effect.succeed(
            options.passes(source)
              ? { _tag: "Passed", cases: [{ name: "solved", passed: true }] }
              : {
                _tag: "TestsFailed",
                cases: [
                  { name: "solved", passed: false, message: "not solved" }
                ]
              }
          )
      })
    )

    const CurriculumLive = Curriculum.layer.pipe(
      Layer.provide(Layer.succeed(Concepts, options.concepts))
    )

    const Environment = Layer.mergeAll(
      Progress.layer,
      CurriculumLive,
      CheckerStub,
      ProcessStub
    ).pipe(Layer.provideMerge(Platform))

    const children = (dir: string) =>
      Ref.get(disk).pipe(
        Effect.map((map) => {
          const base = key(dir)
          const names = new Set<string>()
          for (const each of map.keys()) {
            if (each.startsWith(`${base}/`)) {
              names.add(each.slice(base.length + 1).split("/")[0]!)
            }
          }
          return Array.from(names).sort()
        })
      )

    const read = (file: string) =>
      Ref.get(disk).pipe(
        Effect.flatMap((map) => {
          const text = map.get(key(file))
          return text === undefined
            ? Effect.die(new Error(`no file ${file}`))
            : Effect.succeed(text)
        })
      )

    return {
      Environment,
      files: children("."),
      nested: children,
      read,
      write: put,
      remove: (file: string) =>
        Ref.update(disk, (map) => {
          const next = new Map(map)
          next.delete(key(file))
          return next
        }),
      installs: Ref.get(installLog).pipe(Effect.map((log) => log.join("")))
    }
  }).pipe(Effect.provide(Path.layer))

const silent = () => undefined

export const session = (options: WorldOptions) =>
  Effect.gen(function*() {
    const w = yield* world(options)
    const lines = yield* Ref.make<ReadonlyArray<string>>([])
    const record = (...args: ReadonlyArray<unknown>) =>
      Effect.runSync(Ref.update(lines, (all) => [...all, args.join(" ")]))
    const capture: Console.Console = {
      assert: silent,
      clear: silent,
      count: silent,
      countReset: silent,
      debug: silent,
      dir: silent,
      dirxml: silent,
      error: record,
      group: silent,
      groupCollapsed: silent,
      groupEnd: silent,
      info: silent,
      log: record,
      table: silent,
      time: silent,
      timeEnd: silent,
      timeLog: silent,
      trace: silent,
      warn: silent
    }
    const Cli = Layer.merge(
      w.Environment,
      CliConfig.layer({ builtIns: [GlobalFlag.Help] })
    )

    const t = (...args: ReadonlyArray<string>) =>
      Effect.gen(function*() {
        yield* Ref.set(lines, [])
        const exit = yield* Command.runWith(command, { version: "0.0.0" })(
          args
        ).pipe(
          Effect.provideService(Console.Console, capture),
          Effect.provide(Cli),
          Effect.exit
        )
        const out = (yield* Ref.get(lines)).join("\n")
        yield* clean(out)
        return { out, code: exit._tag === "Success" ? 0 : 1 }
      })

    return {
      t,
      files: w.files,
      nested: w.nested,
      read: w.read,
      write: w.write,
      remove: w.remove,
      installs: w.installs
    }
  })

export type Session = Effect.Success<ReturnType<typeof session>>
