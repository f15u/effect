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
    | "NoGoalLeft"
    | "Declined"
    | "NothingForNow"
    | "BadArgument"
    | "NoAnswer"
    | "SetupFailed"
    | "BadState"
  readonly message: string
}> {}
