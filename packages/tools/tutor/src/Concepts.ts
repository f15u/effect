import { bugIsNotAnError } from "./concepts/bug-is-not-an-error/concept.ts"
import { containADefect } from "./concepts/contain-a-defect/concept.ts"
import { errorsInTheType } from "./concepts/errors-in-the-type/concept.ts"
import { giveUpOnPurpose } from "./concepts/give-up-on-purpose/concept.ts"
import { handleAllErrors } from "./concepts/handle-all-errors/concept.ts"
import { handleOneError } from "./concepts/handle-one-error/concept.ts"
import { namedErrors } from "./concepts/named-errors/concept.ts"
import { thrownErrorsHide } from "./concepts/thrown-errors-hide/concept.ts"
import { triageFailures } from "./concepts/triage-failures/concept.ts"
import { wrapWhatThrows } from "./concepts/wrap-what-throws/concept.ts"

export const concepts = [
  thrownErrorsHide,
  wrapWhatThrows,
  namedErrors,
  errorsInTheType,
  handleOneError,
  handleAllErrors,
  bugIsNotAnError,
  triageFailures,
  giveUpOnPurpose,
  containADefect
] as const
