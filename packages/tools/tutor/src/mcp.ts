import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Layer from "effect/Layer"
import * as Path from "effect/Path"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import * as McpProtocol from "effect/ai/McpProtocol"
import * as McpSchema from "effect/ai/McpSchema"
import * as McpServer from "effect/ai/McpServer"
import { Checker } from "./Checker.ts"
import * as Commands from "./Commands.ts"
import { Curriculum } from "./Curriculum.ts"
import { Process } from "./Process.ts"
import { TutorError } from "./TutorError.ts"
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

const words = Schema.optionalKey(
  Schema.String.annotate({
    title: "In your own words (optional)",
    description: "Anything you want the tutor to know.",
  }),
)

const pickGoal = Effect.gen(function* () {
  const open = yield* Commands.goalPrompt
  if (open.length === 0)
    return yield* new TutorError({
      reason: "NoGoalLeft",
      message: "No goal is left. Every goal is done.",
    })
  const reply = yield* McpServer.elicit({
    message:
      "What do you want to be able to do? (Open the list below and choose one.)",
    schema: Schema.Struct({
      choice: Schema.Literals([
        ...open.map((item) => item.label),
        Commands.nothingForNow,
      ] as unknown as [string, ...Array<string>]),
      words,
    }),
  }).pipe(
    Effect.catchTag("ElicitationDeclined", () =>
      Effect.fail(
        new TutorError({
          reason: "Declined",
          message: "The learner did not pick a goal. Ask again.",
        }),
      ),
    ),
  )
  if (reply.choice === Commands.nothingForNow)
    return yield* new TutorError({
      reason: "NothingForNow",
      message: "The learner wants nothing for now. Stop here and say goodbye.",
    })
  const picked = open.find((item) => item.label === reply.choice)!
  const said = (reply.words ?? "").trim()
  const lines = yield* Commands.goal(picked.id, true)
  return said === "" ? lines : [...lines, `The learner also wrote: "${said}"`]
})

const askProbe = Effect.gen(function* () {
  const canAsk = (yield* McpServer.clientCapabilities).elicitation !== undefined
  if (!canAsk)
    return yield* new TutorError({
      reason: "BadArgument",
      message: "This client cannot show a picker. Go on to the mode choice.",
    })
  const prompt = yield* Commands.probePrompt
  const reply = yield* McpServer.elicit({
    message: prompt.message,
    schema: Schema.Struct({
      choice: Schema.Literals(prompt.options as [string, ...Array<string>]),
      words,
    }),
  }).pipe(
    Effect.map((answer): Commands.ProbeReply => ({
      _tag: "Picked",
      label: answer.choice,
      words: answer.words ?? "",
    })),
    Effect.catchTag("ElicitationDeclined", () =>
      Effect.succeed<Commands.ProbeReply>({ _tag: "Declined", words: "" }),
    ),
  )
  return yield* Commands.probe(reply)
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
    "Lets the learner pick their goal in a picker. Only a client that cannot show a picker needs the goals argument, with one goal id the learner chose in chat.",
    {
      goals: {
        type: "array",
        items: { type: "string" },
        description:
          "One goal id. Only for a client that cannot show a picker.",
      },
    },
    [],
    (payload) =>
      Effect.gen(function* () {
        const canAsk =
          (yield* McpServer.clientCapabilities).elicitation !== undefined
        const goals = field(payload, "goals")
        const given = Array.isArray(goals) ? String(goals[0] ?? "") : ""
        return yield* via("goal", canAsk ? pickGoal : Commands.goal(given))
      }),
  )
  yield* add(
    "probe",
    "Shows the learner one single-choice question in a picker. The learner picks; the server records it. Takes no argument. Never describe the options.",
    {},
    [],
    () => via("probe", askProbe),
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
