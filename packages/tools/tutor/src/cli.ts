#!/usr/bin/env node

import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import * as NodeServices from "@effect/platform-node/NodeServices"
import * as Cause from "effect/Cause"
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as CliConfig from "effect/cli/CliConfig"
import * as Command from "effect/cli/Command"
import * as GlobalFlag from "effect/cli/GlobalFlag"
import { Checker } from "./Checker.ts"
import { command, Failed } from "./Program.ts"
import { Curriculum } from "./Curriculum.ts"
import { Process } from "./Process.ts"
import { Progress } from "./Progress.ts"

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
