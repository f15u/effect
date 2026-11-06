#!/usr/bin/env node

import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import * as NodeServices from "@effect/platform-node/NodeServices"
import * as Cause from "effect/Cause"
import * as Console from "effect/Console"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Argument from "effect/cli/Argument"
import * as CliConfig from "effect/cli/CliConfig"
import * as Command from "effect/cli/Command"
import * as Flag from "effect/cli/Flag"
import * as GlobalFlag from "effect/cli/GlobalFlag"
import * as Commands from "./Commands.ts"
import { TutorError } from "./TutorError.ts"
import { Checker } from "./Checker.ts"
import { Curriculum } from "./Curriculum.ts"
import { McpLive } from "./mcp.ts"
import { Process } from "./Process.ts"
import { Progress } from "./Progress.ts"
import { setup } from "./Setup.ts"

class Failed extends Data.TaggedError("Failed")<{}> {}

const shell = <E, R>(
  name: string,
  handler: Effect.Effect<ReadonlyArray<string>, E | TutorError, R>,
) =>
  Commands.execute(name, handler).pipe(
    Effect.flatMap((output) =>
      Console.log(output.text).pipe(
        Effect.andThen(output.ok ? Effect.void : Effect.fail(new Failed())),
      ),
    ),
  )

const statusCommand = Command.make("status").pipe(
  Command.withDescription("Show what to do next"),
  Command.withHandler(() => shell("status", Commands.status)),
)

const goalCommand = Command.make("goal", {
  id: Argument.String("goal"),
  write: Flag.Boolean("write").pipe(Flag.withDefault(false)),
}).pipe(
  Command.withDescription("Pick a goal"),
  Command.withHandler(({ id, write }) =>
    shell("goal", Commands.goal(id, { write })),
  ),
)

const probeCommand = Command.make("probe").pipe(
  Command.withDescription("Skip the question (the question is MCP only)"),
  Command.withHandler(() => shell("probe", Commands.skipProbe)),
)

const modeCommand = Command.make("mode", {
  mode: Argument.Literals("exercise|project", Commands.Mode.literals),
  folder: Argument.String("folder").pipe(Argument.optional),
  install: Flag.Boolean("install").pipe(Flag.withDefault(false)),
}).pipe(
  Command.withDescription("Choose how to practise"),
  Command.withHandler(({ mode, folder, install }) =>
    shell("mode", Commands.mode(mode, folder, install)),
  ),
)

const checkCommand = Command.make("check").pipe(
  Command.withDescription("Run the goal test on the learner's file"),
  Command.withHandler(() => shell("check", Commands.check)),
)

const replayCommand = Command.make("replay", {
  how: Argument.Literals("answered|skipped", Commands.Replay.literals),
}).pipe(
  Command.withDescription(
    "Say if the learner answered the replay or skipped it",
  ),
  Command.withHandler(({ how }) => shell("replay", Commands.replay(how))),
)

const hintCommand = Command.make("hint").pipe(
  Command.withDescription("Give the next hint"),
  Command.withHandler(() => shell("hint", Commands.hint)),
)

const solutionCommand = Command.make("solution", {
  said: Flag.String("said").pipe(Flag.withDefault("")),
}).pipe(
  Command.withDescription("Show the solution when it is unlocked"),
  Command.withHandler(({ said }) => shell("solution", Commands.solution(said))),
)

const confirmCommand = Command.make("confirm", {
  file: Argument.String("file"),
  quote: Flag.String("quote").pipe(Flag.withDefault("")),
}).pipe(
  Command.withDescription("Check a line of the learner's own file"),
  Command.withHandler(({ file, quote }) =>
    shell("confirm", Commands.confirm(file, quote)),
  ),
)

const resetCommand = Command.make("reset").pipe(
  Command.withDescription("Restore the starter file"),
  Command.withHandler(() => shell("reset", Commands.reset)),
)

const mcpCommand = Command.make("mcp").pipe(
  Command.withDescription("Run as an MCP server over stdio"),
  Command.withHandler(() => Layer.launch(McpLive)),
)

const setupCommand = Command.make("setup").pipe(
  Command.withDescription("Register the Tutor CLI with your agents"),
  Command.withHandler(() => setup),
)

export const command = Command.make("tutor").pipe(
  Command.withDescription("Learn Effect with an AI tutor"),
  Command.withHandler(() => shell("status", Commands.status)),
  Command.withSubcommands([
    statusCommand,
    goalCommand,
    probeCommand,
    modeCommand,
    checkCommand,
    replayCommand,
    hintCommand,
    solutionCommand,
    confirmCommand,
    resetCommand,
    mcpCommand,
    setupCommand,
  ]),
)

const MainLayer = Layer.mergeAll(
  Progress.layer,
  Curriculum.layer,
  Process.layer,
  Checker.layer,
).pipe(
  Layer.provideMerge(
    Layer.mergeAll(
      CliConfig.layer({ builtIns: [GlobalFlag.Help] }),
      NodeServices.layer,
    ),
  ),
)

Command.run(command, { version: "0.0.0" }).pipe(
  Effect.tapCause((cause) => {
    const error = Cause.findError(cause)
    return error._tag === "Success" && error.success instanceof Failed
      ? Effect.void
      : Console.error(Cause.pretty(cause))
  }),
  Effect.provide(MainLayer),
  NodeRuntime.runMain({ disableErrorReporting: true }),
)
