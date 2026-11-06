import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import { TutorError } from "./TutorError.ts"

const sourceFile = /\.(?:[cm]?[jt]s|[jt]sx)$/
const minQuoteChars = 8
const maxBytes = 1_048_576

const badArgument = (message: string) =>
  new TutorError({ reason: "BadArgument", message })

export const holdsLine = (file: string, quote: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const line = quote.trim()
    if (line.replace(/\s/g, "").length < minQuoteChars)
      return yield* badArgument(
        `Quote a line with at least ${minQuoteChars} characters that are not spaces. A short line such as a closing brace proves nothing.`,
      )
    const held =
      sourceFile.test(file) &&
      (yield* fs.stat(file).pipe(
        Effect.flatMap((info) =>
          info.type === "File" && Number(info.size) <= maxBytes
            ? fs
                .readFileString(file)
                .pipe(
                  Effect.map((source) =>
                    source.split("\n").some((each) => each.trim() === line),
                  ),
                )
            : Effect.succeed(false),
        ),
        Effect.orElseSucceed(() => false),
      ))
    if (!held)
      return yield* badArgument(
        `${file} is not a source file of the learner's project that holds that line. It must be a regular file under ${maxBytes / 1_048_576} MiB. Ask which file shows it, read it again, and quote one line exactly.`,
      )
  })
