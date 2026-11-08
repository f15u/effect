import type { Phase } from "./Progress.ts"

export type Surface = "shell" | "mcp"

export interface Action {
  readonly name: string
  readonly cli: string
  readonly tool: string
  readonly summary: string
}

export const machine: Record<Phase, ReadonlyArray<Action>> = {
  Menu: [
    {
      name: "goal",
      cli: "effect-tutor learn goal <id>",
      tool: "tutor_goal {goals: [\"<id>\"]}",
      summary: "pick the goal the learner chose"
    }
  ],
  Probing: [
    {
      name: "probe",
      cli: "effect-tutor learn probe",
      tool: "tutor_probe",
      summary: "show the learner one question with options; they pick"
    }
  ],
  ChoosingMode: [
    {
      name: "mode",
      cli: "effect-tutor learn mode exercise",
      tool: "tutor_mode {mode: \"exercise\"}",
      summary: "practise with a small exercise"
    },
    {
      name: "mode",
      cli: "effect-tutor learn mode project",
      tool: "tutor_mode {mode: \"project\"}",
      summary: "practise in the learner's own project"
    }
  ],
  Working: [
    {
      name: "mode",
      cli: "effect-tutor learn mode exercise <folder> --install",
      tool: "tutor_mode {mode: \"exercise\", folder: \"<folder>\", install: true}",
      summary: "write missing exercise files again, or install after a yes"
    },
    {
      name: "check",
      cli: "effect-tutor learn check",
      tool: "tutor_check",
      summary: "run the goal test on the learner's file"
    },
    {
      name: "hint",
      cli: "effect-tutor learn hint",
      tool: "tutor_hint",
      summary: "give the next hint"
    },
    {
      name: "solution",
      cli: "effect-tutor learn solution --said \"<the learner's words asking for it>\"",
      tool: "tutor_solution {said: \"<the learner's words asking for it>\"}",
      summary: "show the solution (locked until the hints are used, or the learner asks)"
    },
    {
      name: "reset",
      cli: "effect-tutor learn reset",
      tool: "tutor_reset",
      summary: "restore the starter file and clear the hints"
    }
  ],
  Replaying: [
    {
      name: "replay",
      cli: "effect-tutor learn replay answered",
      tool: "tutor_replay {how: \"answered\"}",
      summary: "the learner answered the question again"
    },
    {
      name: "replay",
      cli: "effect-tutor learn replay skipped",
      tool: "tutor_replay {how: \"skipped\"}",
      summary: "the learner skipped it"
    }
  ],
  ProjectWork: [
    {
      name: "mode",
      cli: "effect-tutor learn mode exercise <folder>",
      tool: "tutor_mode {mode: \"exercise\"}",
      summary: "leave project work and practise with a small exercise"
    },
    {
      name: "confirm",
      cli: "effect-tutor learn confirm <file> --quote \"<a line of the file>\"",
      tool: "tutor_confirm {file: \"<file>\", quote: \"<a line of the file>\"}",
      summary: "check the learner's file; the learner then confirms it is their code"
    }
  ]
}

export const commandNames: ReadonlyArray<string> = [
  ...new Set(
    Object.values(machine).flatMap((actions) => actions.map((action) => action.name))
  )
]

export const allows = (phase: Phase, name: string): boolean =>
  name === "status" || machine[phase].some((action) => action.name === name)

export const youCanNow = (phase: Phase, surface: Surface = "shell"): string =>
  `You can now:\n${
    machine[phase]
      .map(
        (action) => `  ${surface === "mcp" ? action.tool : action.cli}  # ${action.summary}`
      )
      .join("\n")
  }`
