import { fileURLToPath } from "node:url"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Layer from "effect/Layer"
import * as Path from "effect/Path"
import * as Schema from "effect/Schema"
import { Process } from "./Process.ts"

const Case = Schema.Struct({
  name: Schema.String,
  passed: Schema.Boolean,
  message: Schema.optionalKey(Schema.String),
})
export type Case = typeof Case.Type

const Cases = Schema.fromJsonString(Schema.Array(Case))

export type CheckResult =
  | { readonly _tag: "Passed"; readonly cases: ReadonlyArray<Case> }
  | { readonly _tag: "TypeErrors"; readonly lines: ReadonlyArray<string> }
  | { readonly _tag: "TestsFailed"; readonly cases: ReadonlyArray<Case> }
  | { readonly _tag: "Crashed"; readonly message: string }

const tsconfig = JSON.stringify({
  compilerOptions: {
    strict: true,
    noEmit: true,
    target: "es2022",
    module: "nodenext",
    moduleResolution: "nodenext",
    skipLibCheck: true,
    allowImportingTsExtensions: true,
  },
  files: ["main.ts"],
})

const marker = "TUTOR_RESULT "

export const renderCheck = (result: CheckResult): ReadonlyArray<string> => {
  switch (result._tag) {
    case "Passed":
      return ["PASSED", ...result.cases.map((item) => `  ok   ${item.name}`)]
    case "TypeErrors":
      return [
        "TYPE ERRORS",
        ...result.lines.map((line) => `  ${line}`),
        "Ask the learner what the first error means. Do not fix it.",
      ]
    case "TestsFailed":
      return [
        "NOT YET",
        ...result.cases.map((item) =>
          item.passed
            ? `  ok   ${item.name}`
            : `  FAIL ${item.name}${item.message === undefined ? "" : `\n         ${item.message}`}`,
        ),
        "Ask the learner a question about the first failure. Do not fix it.",
      ]
    case "Crashed":
      return ["NOT YET: the file crashed.", result.message]
  }
}

export class Checker extends Context.Service<
  Checker,
  {
    readonly run: (test: string, source: string) => Effect.Effect<CheckResult>
  }
>()("tutor/Checker", {
  make: Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const process = yield* Process
    const src = import.meta.dirname
    const shim = path.resolve(src, "tutorial-test.mjs")
    const tsc = fileURLToPath(import.meta.resolve("typescript/bin/tsc"))
    const effectDir = path.dirname(
      fileURLToPath(import.meta.resolve("effect/package.json")),
    )

    const prepareTest = (test: string) =>
      test
        .replace(`"tutorial-test"`, JSON.stringify(shim))
        .replace(`"./main"`, `"./main.ts"`)

    const run = Effect.fn("Checker.run")(
      function* (test: string, source: string) {
        const dir = yield* fs.makeTempDirectoryScoped({
          prefix: "tutor-check-",
        })
        yield* fs.makeDirectory(path.join(dir, "node_modules"))
        yield* fs.symlink(effectDir, path.join(dir, "node_modules", "effect"))
        yield* fs.writeFileString(path.join(dir, "main.ts"), source)
        yield* fs.writeFileString(
          path.join(dir, "main.test.ts"),
          prepareTest(test),
        )
        yield* fs.writeFileString(path.join(dir, "tsconfig.json"), tsconfig)

        const types = yield* process.execute("node", [tsc, "-p", "."], dir)
        if (types.exitCode !== 0) {
          const lines = types.stdout
            .split("\n")
            .filter((line) => line.includes("error TS"))
          return { _tag: "TypeErrors", lines } as const
        }

        const tests = yield* process.execute(
          "node",
          ["--no-warnings", "main.test.ts"],
          dir,
        )
        const line = tests.stdout
          .split("\n")
          .find((candidate) => candidate.startsWith(marker))
        if (line === undefined) {
          return {
            _tag: "Crashed",
            message: (tests.stderr || tests.stdout).trim().slice(0, 1500),
          } as const
        }
        const cases = yield* Schema.decodeUnknownEffect(Cases)(
          line.slice(marker.length),
        )
        return cases.every((item) => item.passed)
          ? ({ _tag: "Passed", cases } as const)
          : ({ _tag: "TestsFailed", cases } as const)
      },
      Effect.scoped,
      Effect.orDie,
    )

    return { run }
  }),
}) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(Process.layer),
  )
}
