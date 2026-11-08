import { Effect } from "effect"

export const runs: Array<string> = []

export const program = Effect.sync(() => {
  runs.push("ran")
  return "receipt_1"
})

export const main = (): Promise<string> => Effect.runPromise(program)
