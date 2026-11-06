import type { PlatformError } from "effect/PlatformError"
import * as Config from "effect/Config"
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Path from "effect/Path"
import * as Stream from "effect/Stream"
import * as Terminal from "effect/Terminal"
import * as ChildProcess from "effect/process/ChildProcess"
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner"

interface Plan {
  readonly label: string
  readonly why: string
  readonly show: ReadonlyArray<string>
  readonly apply: Effect.Effect<
    void,
    PlatformError,
    FileSystem.FileSystem | ChildProcessSpawner.ChildProcessSpawner
  >
}

const runCommand = (line: string) => {
  const [command, ...args] = line.split(" ")
  return Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
    yield* Effect.scoped(
      Effect.gen(function* () {
        const handle = yield* spawner.spawn(
          ChildProcess.make(command!, args, { stdin: "ignore" }),
        )
        yield* handle.exitCode
      }),
    )
  })
}

const claudeCommand = "claude mcp add --scope project tutor -- tutor mcp"

const claudePlan: Plan = {
  label: "Claude Code",
  why: "This registers the Tutor CLI as an MCP server for this folder, so Claude Code can call it. The command writes a .mcp.json file here. The learner must approve the project .mcp.json once, when Claude Code first asks.",
  show: [claudeCommand],
  apply: runCommand(claudeCommand),
}

const codexCommand = "codex mcp add tutor -- tutor mcp"

const codexPlan: Plan = {
  label: "Codex",
  why: "This registers the Tutor CLI as an MCP server in your Codex user config (~/.codex/config.toml), so Codex can call it.",
  show: [codexCommand],
  apply: runCommand(codexCommand),
}

const opencodeFile = "opencode.json"

const opencodeConfig = (major: number) =>
  major >= 2
    ? {
        mcp: {
          servers: { tutor: { type: "local", command: ["tutor", "mcp"] } },
        },
      }
    : {
        $schema: "https://opencode.ai/config.json",
        mcp: {
          tutor: { type: "local", command: ["tutor", "mcp"], enabled: true },
        },
      }

const opencodeMajor = Effect.gen(function* () {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
  const text = yield* Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* spawner.spawn(
        ChildProcess.make("opencode", ["--version"], { stdin: "ignore" }),
      )
      return yield* handle.stdout.pipe(Stream.decodeText(), Stream.mkString)
    }),
  )
  return Number(/(\d+)\./.exec(text)?.[1] ?? 1)
})

const opencodePlan = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  if (yield* fs.exists(opencodeFile)) return undefined
  const json = JSON.stringify(opencodeConfig(yield* opencodeMajor), null, 2)
  const plan: Plan = {
    label: "opencode",
    why: `This creates ${opencodeFile} in this folder. It registers the Tutor CLI as an MCP server, so opencode can call it.`,
    show: [`Create ${opencodeFile} with:`, json],
    apply: fs.writeFileString(opencodeFile, `${json}\n`),
  }
  return plan
})

const onPath = Effect.fn("Setup.onPath")(function* (name: string) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const dirs = (yield* Config.String("PATH").pipe(
    Config.withDefault(""),
  )).split(":")
  for (const dir of dirs) {
    if (dir !== "" && (yield* fs.exists(path.join(dir, name)))) return true
  }
  return false
})

const isYes = (answer: string) => /^y(es)?$/i.test(answer.trim())

const offer = Effect.fn("Setup.offer")(function* (plan: Plan) {
  const terminal = yield* Terminal.Terminal
  yield* Console.log(`\n${plan.label}\n${plan.show.join("\n")}\n${plan.why}`)
  yield* terminal.display("Apply this? [y/N] ")
  const answer = yield* terminal.readLine
  if (isYes(answer)) {
    yield* plan.apply
    yield* Console.log(`Done: ${plan.label}.`)
  } else {
    yield* Console.log(
      `Nothing changed.\nRun this yourself:\n${plan.show.join("\n")}`,
    )
  }
})

export const setup = Effect.gen(function* () {
  const found = {
    claude: yield* onPath("claude"),
    opencode: yield* onPath("opencode"),
    codex: yield* onPath("codex"),
  }
  if (!found.claude && !found.opencode && !found.codex) {
    yield* Console.log(
      "No agent found. Looked for claude, opencode and codex on your PATH. Nothing changed.",
    )
    return
  }
  if (found.claude) yield* offer(claudePlan)
  if (found.opencode) {
    const plan = yield* opencodePlan
    if (plan) {
      yield* offer(plan)
    } else {
      yield* Console.log(
        `\nopencode\n${opencodeFile} already exists here, so setup does not touch it. Add the Tutor CLI under "mcp" yourself:\n${JSON.stringify(opencodeConfig(yield* opencodeMajor), null, 2)}`,
      )
    }
  }
  if (found.codex) yield* offer(codexPlan)
})
