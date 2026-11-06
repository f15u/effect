import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Layer from "effect/Layer"
import * as Path from "effect/Path"
import * as Option from "effect/Option"
import * as McpProtocol from "effect/ai/McpProtocol"
import * as McpSchema from "effect/ai/McpSchema"
import * as McpServer from "effect/ai/McpServer"
import { Checker } from "./Checker.ts"
import * as Commands from "./Commands.ts"
import { Curriculum } from "./Curriculum.ts"
import { Process } from "./Process.ts"
import { Progress } from "./Progress.ts"
import { agentInstructions } from "./rules.ts"

const text = (output: Commands.Output) =>
  new McpSchema.CallToolResult({
    content: [{ type: "text", text: output.text }],
    isError: !output.ok,
  })

const field = (payload: unknown, key: string): unknown =>
  (payload as Record<string, unknown> | undefined)?.[key]

const string = (payload: unknown, key: string): string => {
  const value = field(payload, key)
  return typeof value === "string" ? value : ""
}

const prop = (description: string, extra: Record<string, unknown> = {}) => ({
  type: "string",
  description,
  ...extra,
})

export const registerTools = Effect.gen(function* () {
  const server = yield* McpServer.McpServer
  const services = yield* Effect.context<
    | Curriculum
    | Progress
    | Checker
    | Process
    | FileSystem.FileSystem
    | Path.Path
  >()

  const add = (
    name: string,
    description: string,
    properties: Record<string, Record<string, unknown>>,
    required: ReadonlyArray<string>,
    run: (payload: unknown) => Effect.Effect<Commands.Output, never, any>,
  ) =>
    server.addTool({
      tool: new McpSchema.Tool({
        name: `tutor_${name}`,
        description,
        inputSchema: {
          type: "object",
          properties: properties as any,
          required,
        },
      }),
      annotations: Context.empty(),
      handle: (payload) =>
        run(payload).pipe(
          Effect.map(text),
          Effect.provideContext(services as Context.Context<any>),
        ) as Effect.Effect<
          McpSchema.CallToolResult,
          never,
          McpSchema.McpRequestContext
        >,
    })

  const via = <E, R>(
    name: string,
    handler: Effect.Effect<ReadonlyArray<string>, E, R>,
  ) => Commands.execute(name, handler, "mcp")

  yield* add(
    "status",
    "Shows what to do next. Call it first in a session.",
    {},
    [],
    () => via("status", Commands.status),
  )
  yield* add(
    "goal",
    "Picks the goal the learner chose in chat.",
    {
      goals: {
        type: "array",
        items: { type: "string" },
        description: "One goal id.",
      },
    },
    ["goals"],
    (payload) => {
      const goals = field(payload, "goals")
      const id = Array.isArray(goals) ? String(goals[0] ?? "") : ""
      return via("goal", Commands.goal(id))
    },
  )
  yield* add(
    "mode",
    "Chooses how the learner practises the concept.",
    {
      mode: prop("exercise or project", { enum: ["exercise", "project"] }),
      folder: prop("Exercise folder name, relative to this folder."),
      install: {
        type: "boolean",
        description:
          "Install effect and typescript. Only after the learner said yes.",
      },
    },
    ["mode"],
    (payload) => {
      const folder = string(payload, "folder")
      return via(
        "mode",
        Commands.mode(
          string(payload, "mode"),
          folder === "" ? Option.none() : Option.some(folder),
          field(payload, "install") === true,
          "mcp",
        ),
      )
    },
  )
  yield* add(
    "check",
    "Runs the goal test on the learner's file. Run it before every reply in an exercise.",
    {},
    [],
    () => via("check", Commands.check),
  )
  yield* add("hint", "Gives the next hint.", {}, [], () =>
    via("hint", Commands.hint),
  )
  yield* add(
    "solution",
    "Shows the solution. Locked until all hints are used, or the learner asks for it in their own words.",
    { said: prop("The learner's own words asking for the solution") },
    [],
    (payload) => via("solution", Commands.solution(string(payload, "said"))),
  )
  yield* add("reset", "Restores the starter file.", {}, [], () =>
    via("reset", Commands.reset),
  )
})

export const McpLive = Layer.effectDiscard(registerTools).pipe(
  Layer.provideMerge(
    McpServer.layerStdio({
      name: "tutor",
      version: "0.0.0",
      instructions: agentInstructions,
      protocols: [McpProtocol.v2025_11_25],
    }),
  ),
)
