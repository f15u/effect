import { catchADefect } from "./catch-a-defect/concept.ts"
import { catchATag } from "./catch-a-tag/concept.ts"
import { fatalAtBoundary } from "./fatal-at-boundary/concept.ts"
import { handleEveryError } from "./handle-every-error/concept.ts"
import { stopOnBrokenRule } from "./stop-on-broken-rule/concept.ts"
import { taggedErrors } from "./tagged-errors/concept.ts"
import { typedFailure } from "./typed-failure/concept.ts"

export const concepts = [
  taggedErrors,
  typedFailure,
  catchATag,
  handleEveryError,
  stopOnBrokenRule,
  fatalAtBoundary,
  catchADefect,
] as const
