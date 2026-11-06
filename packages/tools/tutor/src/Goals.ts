export interface Goal {
  readonly id: string
  readonly title: string
}

export const goals: ReadonlyArray<Goal> = [
  { id: "see-every-failure", title: "See every way my code can fail" },
  {
    id: "keep-server-alive",
    title: "Keep a server alive when something unexpected breaks",
  },
]
