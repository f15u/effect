import type { Phase } from "./Progress.ts"

export interface Action {
  readonly name: string
  readonly cli: string
  readonly summary: string
}

export const machine: Record<Phase, ReadonlyArray<Action>> = {
  Menu: [
    {
      name: "goal",
      cli: "tutor goal <id>",
      summary: "pick the goal the learner chose",
    },
  ],
  ChoosingMode: [
    {
      name: "mode",
      cli: "tutor mode exercise",
      summary: "practise with a small exercise",
    },
    {
      name: "mode",
      cli: "tutor mode project",
      summary: "practise in the learner's own project",
    },
  ],
  Working: [
    {
      name: "mode",
      cli: "tutor mode exercise <folder> --install",
      summary: "write missing exercise files again, or install after a yes",
    },
    {
      name: "check",
      cli: "tutor check",
      summary: "run the goal test on the learner's file",
    },
    { name: "hint", cli: "tutor hint", summary: "give the next hint" },
    {
      name: "solution",
      cli: 'tutor solution --said "<the learner\'s words asking for it>"',
      summary:
        "show the solution (locked until the hints are used, or the learner asks)",
    },
    {
      name: "reset",
      cli: "tutor reset",
      summary: "restore the starter file and clear the hints",
    },
  ],
}

export const commandNames: ReadonlyArray<string> = [
  ...new Set(
    Object.values(machine).flatMap((actions) =>
      actions.map((action) => action.name),
    ),
  ),
]

export const allows = (phase: Phase, name: string): boolean =>
  name === "status" || machine[phase].some((action) => action.name === name)

export const youCanNow = (phase: Phase): string =>
  `You can now:\n${machine[phase]
    .map((action) => `  ${action.cli}  # ${action.summary}`)
    .join("\n")}`
