import { defineConcept } from "../../Concept.ts"
import { bugIsNotAnError } from "../bug-is-not-an-error/concept.ts"
import { handleOneError } from "../handle-one-error/concept.ts"

export const giveUpOnPurpose = defineConcept({
  dir: import.meta.dirname,
  id: "give-up-on-purpose",
  title: "Choosing to stop on a typed error",
  needs: [bugIsNotAnError, handleOneError],
  probe: {
    question:
      "A nightly job calls processPayment and applies Effect.orDie. What happens to processPayment for its other callers?",
    correct:
      "Nothing. Only the job's own Effect changes, and its Error type becomes never.",
    distractors: [
      {
        text: "processPayment also stops listing typed errors for every caller.",
        belief: "Effect.orDie changes the function that it wraps.",
      },
      {
        text: "The job must still handle all three errors, because orDie only logs them.",
        belief: "Effect.orDie only logs the errors.",
      },
    ],
  },
  keyIdea:
    "A typed error does not force recovery. At a boundary, Effect.orDie turns every typed error into a defect, so the Error type becomes never. To stop on chosen errors only, use Effect.catchTag with Effect.die. The other errors stay in the type. Other callers of the function still see all the typed errors.",
  hints: [
    "The job decides to stop on any failure. Which function turns typed errors into defects?",
    "For `reconcile`, pipe into `Effect.orDie`. For `reconcileSelected`, pipe into `Effect.catchTag` and call `Effect.die` in the handler.",
    'Write `Effect.catchTag("ExpiredCardError", (error) => Effect.die(error))`. The other two errors stay typed.',
  ],
})
