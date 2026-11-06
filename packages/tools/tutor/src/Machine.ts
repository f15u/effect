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
