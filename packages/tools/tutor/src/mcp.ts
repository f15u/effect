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
import { fileReasons } from "./Exercise.ts"
import { Process } from "./Process.ts"
import { TutorError } from "./TutorError.ts"
import { Progress } from "./Progress.ts"
import { agentInstructions } from "./rules.ts"
import { TutorError } from "./TutorError.ts"

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

const folderForm = `Where should the exercise go? Type a folder name, relative to the current folder. The tool writes these files in it:\n${Object.entries(
  fileReasons,
)
  .map(([name, why]) => `- <folder>/${name}: ${why}`)
  .join("\n")}\nNothing is written until you answer.`

const installForm =
  "May the tool run npm install effect typescript in that folder? The exercise imports effect, and the editor needs typescript. It writes node_modules and updates package.json there. Nothing is installed unless you say yes."

const noAnswer = (what: string) =>
  new TutorError({
    reason: "NoAnswer",
    message: `The learner did not answer the ${what} form. Ask in chat what they want.`,
  })

const askFolder = McpServer.elicit({
  message: folderForm,
  schema: Schema.Struct({
    folder: Schema.String.annotate({
      title: "Folder name",
      description: "A new or existing folder, relative to the current folder.",
    }),
  }),
}).pipe(
  Effect.map((reply) => reply.folder.trim()),
  Effect.catchTag("ElicitationDeclined", () => Effect.fail(noAnswer("folder"))),
)

const askInstall = McpServer.elicit({
  message: installForm,
  schema: Schema.Struct({
    install: Schema.Boolean.annotate({
      title: "Install effect and typescript",
    }),
  }),
}).pipe(
  Effect.map((reply) => reply.install),
  Effect.catchTag("ElicitationDeclined", () => Effect.succeed(false)),
)

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
    "Chooses how the learner practises the concept. With mode exercise and a folder, it writes <folder>/main.ts (the starter file), <folder>/package.json and <folder>/tsconfig.json (so the editor shows types), and with install true it runs npm install effect typescript there. Pass the folder only after the learner named it, and install only after the learner said yes.",
    {
      mode: prop("exercise or project", { enum: ["exercise", "project"] }),
      folder: prop(
        "Exercise folder name, relative to this folder. Leave it out if the client can ask the learner: the tool then opens a form. Without a folder name nothing is written.",
      ),
      install: {
        type: "boolean",
        description:
          "Install effect and typescript. Only after the learner said yes.",
      },
    },
    ["mode"],
    (payload) =>
      Effect.gen(function* () {
        const capabilities = yield* McpServer.clientCapabilities
        const canAsk = capabilities.elicitation !== undefined
        const choice = string(payload, "mode")
        const given = string(payload, "folder")
        return yield* via(
          "mode",
          Effect.gen(function* () {
            if (!canAsk || choice !== "exercise")
              return yield* Commands.mode(
                choice,
                given === "" ? Option.none() : Option.some(given),
                field(payload, "install") === true,
                "mcp",
              )
            const folder = given === "" ? yield* askFolder : given
            if (folder === "") return yield* Effect.fail(noAnswer("folder"))
            const install = yield* askInstall
            return yield* Commands.mode(
              choice,
              Option.some(folder),
              install,
              "mcp",
            )
          }),
        )
      }),
  )
  yield* add(
    "check",
    "Runs the goal test on the learner's file. Run it before every reply in an exercise.",
    {},
    [],
    () => via("check", Commands.check),
  )
  yield* add(
    "replay",
    "Records that the learner answered the replay question or skipped it. Never blocks.",
    { how: prop("answered or skipped", { enum: ["answered", "skipped"] }) },
    ["how"],
    (payload) => via("replay", Commands.replay(string(payload, "how"))),
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
