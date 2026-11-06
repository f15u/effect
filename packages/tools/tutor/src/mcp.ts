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

const askOwn = (file: string, quote: string) =>
  McpServer.elicit({
    message: `Is this your code?\nFile: ${file}\nLine: ${quote.trim()}`,
    schema: Schema.Struct({
      confirmed: Schema.Boolean.annotate({ title: "Yes, this is my code" }),
    }),
  }).pipe(
    Effect.map((reply) => reply.confirmed),
    Effect.catchTag("ElicitationDeclined", () => Effect.succeed(false)),
  )

const prop = (description: string, extra: Schema.JsonObject = {}) => ({
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
  const fresh = !(yield* (yield* Progress).exists)
  const reply = yield* McpServer.elicit({
    message: `${fresh ? `${Commands.stateNotice} It is written when you pick.\n` : ""}What do you want to be able to do? (Open the list below and choose one.)`,
    schema: Schema.Struct({
      choice: Schema.Literals([
        ...open.map((item) => item.label),
        Commands.nothingForNow,
      ]),
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
  const lines = yield* Commands.goal(picked.id, {
    trusted: true,
    write: true,
    surface: "mcp",
  })
  return said === "" ? lines : [...lines, `The learner also wrote: "${said}"`]
})

const askProbe = Effect.gen(function* () {
  const canAsk = (yield* McpServer.clientCapabilities).elicitation !== undefined
  if (!canAsk) return yield* Commands.skipProbe
  const prompt = yield* Commands.probePrompt
  const reply = yield* McpServer.elicit({
    message: prompt.message,
    schema: Schema.Struct({
      choice: Schema.Literals(prompt.options),
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

type Needs =
  | Curriculum
  | Progress
  | Checker
  | Process
  | FileSystem.FileSystem
  | Path.Path
  | McpSchema.McpRequestContext
  | McpSchema.McpServerClient

const NoArgs = Schema.Struct({})

export const registerTools = Effect.gen(function* () {
  const server = yield* McpServer.McpServer
  const services =
    yield* Effect.context<
      Exclude<Needs, McpSchema.McpRequestContext | McpSchema.McpServerClient>
    >()

  const add = <A>(
    name: string,
    description: string,
    properties: Readonly<Record<string, Schema.JsonObject>>,
    required: ReadonlyArray<string>,
    args: Schema.Decoder<A>,
    run: (args: A) => Effect.Effect<Commands.Output, never, Needs>,
  ) =>
    server.addTool({
      tool: new McpSchema.Tool({
        name: `tutor_${name}`,
        description,
        inputSchema: { type: "object", properties, required },
      }),
      annotations: Context.empty(),
      handle: (payload) =>
        Schema.decodeUnknownEffect(args)(payload ?? {}).pipe(
          Effect.matchEffect({
            onFailure: (error) =>
              Effect.succeed<Commands.Output>({
                text: `The arguments are not valid: ${error.message}`,
                ok: false,
              }),
            onSuccess: run,
          }),
          Effect.map(text),
          Effect.provideContext(services),
          // McpServer types omit McpServerClient from handler services, but the server provides it per call
          (effect) =>
            effect as Effect.Effect<
              McpSchema.CallToolResult,
              never,
              McpSchema.McpRequestContext
            >,
        ),
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
    NoArgs,
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
      write: {
        type: "boolean",
        description:
          "Only after you told the learner the file name and why. The first call without it writes nothing.",
      },
    },
    [],
    Schema.Struct({
      goals: Schema.optionalKey(Schema.Array(Schema.String)),
      write: Schema.optionalKey(Schema.Boolean),
    }),
    (args) =>
      Effect.gen(function* () {
        const canAsk =
          (yield* McpServer.clientCapabilities).elicitation !== undefined
        const given = args.goals?.[0] ?? ""
        return yield* via(
          "goal",
          canAsk
            ? pickGoal
            : Commands.goal(given, {
                write: args.write === true,
                surface: "mcp",
              }),
        )
      }),
  )
  yield* add(
    "probe",
    "Shows the learner one single-choice question in a picker. The learner picks; the server records it. Takes no argument. Never describe the options.",
    {},
    [],
    NoArgs,
    () => via("probe", askProbe),
  )
  yield* add(
    "mode",
    "Chooses how the learner practises the concept. With mode exercise and a folder, it writes <folder>/main.ts (the starter file), <folder>/package.json and <folder>/tsconfig.json (so the editor shows types), and with install true it runs npm install effect typescript there. Pass the folder only after the learner named it, and install only after the learner said yes.",
    {
      mode: prop("exercise or project", { enum: ["exercise", "project"] }),
      folder: prop(
        "Exercise folder name, relative to this folder. A client that can ask the learner gets a form instead, and this value is ignored. Without a folder name nothing is written.",
      ),
      install: {
        type: "boolean",
        description:
          "Install effect and typescript. Only after the learner said yes.",
      },
    },
    ["mode"],
    Schema.Struct({
      mode: Commands.Mode,
      folder: Schema.optionalKey(Schema.String),
      install: Schema.optionalKey(Schema.Boolean),
    }),
    (args) =>
      Effect.gen(function* () {
        const capabilities = yield* McpServer.clientCapabilities
        const canAsk = capabilities.elicitation !== undefined
        const choice = args.mode
        const given = args.folder ?? ""
        return yield* via(
          "mode",
          Effect.gen(function* () {
            if (!canAsk || choice !== "exercise")
              return yield* Commands.mode(
                choice,
                given === "" ? Option.none() : Option.some(given),
                args.install === true,
                "mcp",
              )
            const folder = yield* askFolder
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
    NoArgs,
    () => via("check", Commands.check),
  )
  yield* add(
    "replay",
    "Records that the learner answered the replay question or skipped it. Never blocks.",
    { how: prop("answered or skipped", { enum: ["answered", "skipped"] }) },
    ["how"],
    Schema.Struct({ how: Commands.Replay }),
    (args) => via("replay", Commands.replay(args.how)),
  )
  yield* add("hint", "Gives the next hint.", {}, [], NoArgs, () =>
    via("hint", Commands.hint),
  )
  yield* add(
    "solution",
    "Shows the solution. Locked until all hints are used, or the learner asks for it in their own words.",
    { said: prop("The learner's own words asking for the solution") },
    [],
    Schema.Struct({ said: Schema.optionalKey(Schema.String) }),
    (args) => via("solution", Commands.solution(args.said ?? "")),
  )
  yield* add(
    "confirm",
    "Checks a file of the learner's own project: the file path and one exact line of it. Never returns file contents and never changes a file. A form then asks the learner if it is their code; only their yes records the concept.",
    {
      file: prop("Path of a source file the learner tagged"),
      quote: prop("One exact line of that file"),
    },
    ["file", "quote"],
    Schema.Struct({ file: Schema.String, quote: Schema.String }),
    (args) =>
      Effect.gen(function* () {
        const canAsk =
          (yield* McpServer.clientCapabilities).elicitation !== undefined
        const { file, quote } = args
        return yield* via(
          "confirm",
          Commands.confirm(
            file,
            quote,
            canAsk ? Option.some(askOwn(file, quote)) : Option.none(),
          ),
        )
      }),
  )
  yield* add("reset", "Restores the starter file.", {}, [], NoArgs, () =>
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
