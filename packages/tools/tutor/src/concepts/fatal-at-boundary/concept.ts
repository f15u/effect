import { defineConcept } from "../../Concept.ts"
import { typedFailure } from "../typed-failure/concept.ts"

export const fatalAtBoundary = defineConcept({
  dir: import.meta.dirname,
  id: "fatal-at-boundary",
  title: "Making every failure fatal",
  goal: "Stop a nightly job on any payment failure",
  needs: [typedFailure],
  probe: {
    question:
      "A nightly job must stop and alert its owner when any payment fails. processPayment has three typed errors. What fits at the job's call site?",
    correct:
      "Effect.orDie. It turns every typed error into a defect, for this job only.",
    distractors: [
      {
        text: "Change processPayment so it never fails.",
        belief:
          "To stop a job, the function itself must stop failing in the type.",
      },
      {
        text: "Effect.catchDefect, because every failure is a defect.",
        belief: "Typed errors are defects already.",
      },
    ],
  },
  keyIdea:
    "Effect.orDie turns every typed error into a defect, so the Error type becomes never. Call it where the job decides not to recover. The function's other callers still see the typed errors.",
  wrongBeliefs: [
    "To stop a job, the function itself must stop failing in the type. (The caller decides, with orDie.)",
    "Typed errors are defects already. (They are separate until orDie or die turns one into the other.)",
  ],
  hints: [
    "The job decides, not processPayment. Which Effect function turns typed errors into defects?",
    "Pipe the result of `processPayment(token)` into `Effect.orDie`.",
    "Write `processPayment(token).pipe(Effect.orDie)` as the body of reconcile.",
  ],
})
