import { bugIsNotAnError } from "./bug-is-not-an-error/concept.ts"
import { containADefect } from "./contain-a-defect/concept.ts"
import { errorsInTheType } from "./errors-in-the-type/concept.ts"
import { giveUpOnPurpose } from "./give-up-on-purpose/concept.ts"
import { handleAllErrors } from "./handle-all-errors/concept.ts"
import { handleOneError } from "./handle-one-error/concept.ts"
import { namedErrors } from "./named-errors/concept.ts"
import { thrownErrorsHide } from "./thrown-errors-hide/concept.ts"
import { triageFailures } from "./triage-failures/concept.ts"
import { wrapWhatThrows } from "./wrap-what-throws/concept.ts"

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
  containADefect,
] as const
