import { assert, describe, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Path from "effect/Path"
import * as Stream from "effect/Stream"
import * as ChildProcess from "effect/process/ChildProcess"
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner"
import { TestLayer } from "./Session.ts"

interface Options {
  readonly agents: ReadonlyArray<string>
  readonly answers: ReadonlyArray<string>
  readonly opencodeVersion?: string
  readonly existing?: Record<string, string>
}

const setupRun = (options: Options) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
    const dir = yield* fs.makeTempDirectoryScoped({ prefix: "tutor-setup-" })
    const bin = yield* fs.makeTempDirectoryScoped({
      prefix: "tutor-setup-bin-",
    })
    const log = path.join(bin, "calls.log")
    for (const agent of options.agents) {
      const version = options.opencodeVersion ?? "1.19.5"
      yield* fs.writeFileString(
        path.join(bin, agent),
        agent === "opencode"
          ? `#!/bin/sh\nif [ "$1" = "--version" ]; then echo "${version}"; exit 0; fi\necho "${agent} $@" >> "${log}"\n`
          : `#!/bin/sh\necho "${agent} $@" >> "${log}"\n`,
        { mode: 0o755 },
      )
    }
    for (const [name, content] of Object.entries(options.existing ?? {}))
      yield* fs.writeFileString(path.join(dir, name), content)
    const cli = path.resolve(import.meta.dirname, "../src/cli.ts")
    const input = Stream.make(
      new TextEncoder().encode(options.answers.map((a) => `${a}\n`).join("")),
    )
    const out = yield* Effect.scoped(
      Effect.gen(function* () {
        const handle = yield* spawner.spawn(
          ChildProcess.make(process.execPath, ["--no-warnings", cli, "setup"], {
            cwd: dir,
            stdin: input,
            env: { PATH: bin },
            extendEnv: false,
          }),
        )
        const [stdout, stderr] = yield* Effect.all(
          [
            handle.stdout.pipe(Stream.decodeText(), Stream.mkString),
            handle.stderr.pipe(Stream.decodeText(), Stream.mkString),
            handle.exitCode,
          ],
          { concurrency: "unbounded" },
        )
        return stdout + stderr
      }),
    )
    const calls = yield* fs
      .readFileString(log)
      .pipe(Effect.orElseSucceed(() => ""))
    const files = yield* fs.readDirectory(dir)
    return {
      out,
      calls,
      files,
      read: (f: string) => fs.readFileString(path.join(dir, f)),
    }
  })

const live = <A, E>(name: string, body: Effect.Effect<A, E, any>) =>
  it.live(
    name,
    () =>
      body.pipe(Effect.scoped, Effect.provide(TestLayer)) as Effect.Effect<
        A,
        E
      >,
  )

describe("tutor setup", () => {
  live(
    "asks only about the agents it finds",
    Effect.gen(function* () {
      const r = yield* setupRun({ agents: ["claude"], answers: ["n"] })
      assert.include(r.out, "Claude Code")
      assert.include(r.out, "Apply this?")
      assert.notInclude(r.out, "opencode")
      assert.notInclude(r.out, "Codex")
    }),
  )

  live(
    "on no it changes nothing and prints the manual steps",
    Effect.gen(function* () {
      const r = yield* setupRun({ agents: ["claude"], answers: ["n"] })
      assert.equal(r.calls, "")
      assert.deepEqual(r.files, [])
      assert.include(r.out, "Nothing changed.")
      assert.include(r.out, "Run this yourself:")
    }),
  )

  live(
    "on yes it runs the command it showed, and says Claude Code asks once to approve .mcp.json",
    Effect.gen(function* () {
      const r = yield* setupRun({ agents: ["claude"], answers: ["y"] })
      assert.include(r.out, "claude mcp add --scope project tutor -- tutor mcp")
      assert.equal(
        r.calls,
        "claude mcp add --scope project tutor -- tutor mcp\n",
      )
      assert.include(r.out, "approve the project .mcp.json once")
    }),
  )

  live(
    "registers Codex with its own command",
    Effect.gen(function* () {
      const r = yield* setupRun({ agents: ["codex"], answers: ["y"] })
      assert.include(r.out, "codex mcp add tutor -- tutor mcp")
      assert.equal(r.calls, "codex mcp add tutor -- tutor mcp\n")
      assert.notInclude(r.out, "Claude Code")
    }),
  )

  live(
    "opencode 1 gets the flat mcp shape and the file written matches what was shown",
    Effect.gen(function* () {
      const r = yield* setupRun({
        agents: ["opencode"],
        answers: ["y"],
        opencodeVersion: "1.19.5",
      })
      const expected = {
        $schema: "https://opencode.ai/config.json",
        mcp: {
          tutor: { type: "local", command: ["tutor", "mcp"], enabled: true },
        },
      }
      assert.deepEqual(r.files, ["opencode.json"])
      assert.deepEqual(JSON.parse(yield* r.read("opencode.json")), expected)
      assert.include(r.out, JSON.stringify(expected, null, 2))
    }),
  )

  live(
    "opencode 2 gets the mcp.servers shape",
    Effect.gen(function* () {
      const r = yield* setupRun({
        agents: ["opencode"],
        answers: ["y"],
        opencodeVersion: "2.2.5",
      })
      assert.deepEqual(JSON.parse(yield* r.read("opencode.json")), {
        mcp: {
          servers: { tutor: { type: "local", command: ["tutor", "mcp"] } },
        },
      })
    }),
  )

  live(
    "opencode on no writes nothing and prints the file to create",
    Effect.gen(function* () {
      const r = yield* setupRun({ agents: ["opencode"], answers: ["n"] })
      assert.deepEqual(r.files, [])
      assert.include(r.out, "Nothing changed.")
      assert.include(r.out, "opencode.json")
    }),
  )

  live(
    "with no agent found it says so and writes nothing",
    Effect.gen(function* () {
      const r = yield* setupRun({ agents: [], answers: [] })
      assert.include(r.out, "No agent found")
      assert.notInclude(r.out, "Apply this?")
      assert.deepEqual(r.files, [])
    }),
  )

  live(
    "never overwrites an existing opencode.json and prints the manual steps",
    Effect.gen(function* () {
      const r = yield* setupRun({
        agents: ["opencode"],
        answers: [],
        existing: { "opencode.json": "{}" },
      })
      assert.equal(yield* r.read("opencode.json"), "{}")
      assert.include(r.out, "already exists")
      assert.notInclude(r.out, "Apply this?")
    }),
  )
})
