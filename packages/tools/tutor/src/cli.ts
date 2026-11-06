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
import type { TutorError } from "./TutorError.ts"
import { Checker } from "./Checker.ts"
import { Curriculum } from "./Curriculum.ts"
import { Process } from "./Process.ts"
import { Progress } from "./Progress.ts"

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
}).pipe(
  Command.withDescription("Pick a goal"),
  Command.withHandler(({ id }) => shell("goal", Commands.goal(id))),
)

const modeCommand = Command.make("mode", {
  mode: Argument.String("exercise|project"),
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

const resetCommand = Command.make("reset").pipe(
  Command.withDescription("Restore the starter file"),
  Command.withHandler(() => shell("reset", Commands.reset)),
)

export const command = Command.make("tutor").pipe(
  Command.withDescription("Learn Effect with an AI tutor"),
  Command.withHandler(() => shell("status", Commands.status)),
  Command.withSubcommands([
    statusCommand,
    goalCommand,
    modeCommand,
    checkCommand,
    hintCommand,
    solutionCommand,
    resetCommand,
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
