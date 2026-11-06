import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Path from "effect/Path"
import type { Concept } from "./Concept.ts"
import type { Surface } from "./Machine.ts"
import { Curriculum } from "./Curriculum.ts"
import { Process } from "./Process.ts"
import { TutorError } from "./TutorError.ts"

const packageJson = JSON.stringify({ private: true, type: "module" }, null, 2)

const tsconfig = JSON.stringify(
  {
    compilerOptions: {
      strict: true,
      noEmit: true,
      target: "es2022",
      module: "nodenext",
      moduleResolution: "nodenext",
      skipLibCheck: true,
    },
    include: ["main.ts"],
  },
  null,
  2,
)

export const fileReasons = {
  "main.ts": "the starter file you edit",
  "package.json": "so the editor treats the folder as a project",
  "tsconfig.json": "so the editor shows types",
} as const

const hasEffect = (text: string) => {
  try {
    const pkg = JSON.parse(text) as Record<
      string,
      Record<string, unknown> | undefined
    >
    return ["dependencies", "devDependencies", "peerDependencies"].some(
      (key) => pkg[key]?.effect !== undefined,
    )
  } catch {
    return false
  }
}

const findEffectProject = (folder: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    let dir = path.resolve(folder)
    while (true) {
      const file = path.join(dir, "package.json")
      if ((yield* fs.exists(file)) && hasEffect(yield* fs.readFileString(file)))
        return file
      const parent = path.dirname(dir)
      if (parent === dir) return undefined
      dir = parent
    }
  }).pipe(Effect.orDie)

export const materialize = (
  folder: string,
  concept: Concept,
  install: boolean,
  surface: Surface = "shell",
) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const curriculum = yield* Curriculum
    yield* fs.makeDirectory(folder, { recursive: true })
    const existing = yield* findEffectProject(folder)
    const starter = yield* curriculum.file(concept, "starter.ts")
    const files: ReadonlyArray<readonly [string, string, string]> =
      existing === undefined
        ? [
            ["main.ts", starter, fileReasons["main.ts"]],
            ["package.json", `${packageJson}\n`, fileReasons["package.json"]],
            ["tsconfig.json", `${tsconfig}\n`, fileReasons["tsconfig.json"]],
          ]
        : [["main.ts", starter, fileReasons["main.ts"]]]
    const lines: Array<string> =
      existing === undefined
        ? []
        : [
            `${existing} already has effect, so only the starter file is written and nothing is installed.`,
          ]
    for (const [name, content, why] of files) {
      const target = path.join(folder, name)
      if (yield* fs.exists(target)) {
        lines.push(`Kept ${target}: it already exists and is not changed.`)
        continue
      }
      yield* fs.writeFileString(target, content)
      lines.push(`Wrote ${target}: ${why}.`)
    }
    if (existing === undefined) {
      if (install) {
        const result = yield* (yield* Process).execute(
          "npm",
          ["install", "effect", "typescript"],
          path.resolve(folder),
        )
        if (result.exitCode !== 0)
          return yield* new TutorError({
            reason: "InstallFailed",
            message: `Install failed in ${folder}:\n${(result.stderr || result.stdout).trim()}`,
          })
        lines.push(
          `Installed effect and typescript in ${folder}: the exercise imports effect, and the editor needs typescript.`,
        )
      } else {
        lines.push(
          `Nothing is installed. Ask the learner if the tool may install effect and typescript. After a yes, ${surface === "mcp" ? `call tutor_mode with mode exercise, folder ${folder} and install true` : `run: tutor mode exercise ${folder} --install`}.`,
        )
      }
    }
    return lines
  })
