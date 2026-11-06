import * as Data from "effect/Data"

export class TutorError extends Data.TaggedError("TutorError")<{
  readonly reason:
    | "WrongPhase"
    | "UnknownGoal"
    | "MissingFile"
    | "InstallFailed"
    | "BadFolder"
    | "MissingCommand"
    | "SolutionLocked"
    | "NotYet"
    | "NoAnswer"
  readonly message: string
}> {}
