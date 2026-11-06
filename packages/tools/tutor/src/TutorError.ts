import * as Data from "effect/Data"

export class TutorError extends Data.TaggedError("TutorError")<{
  readonly reason: "WrongPhase" | "UnknownGoal" | "MissingFile"
  readonly message: string
}> {}
