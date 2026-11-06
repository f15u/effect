import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Layer from "effect/Layer"
import * as Path from "effect/Path"
import { Checker } from "./Checker.ts"
import type { Concept } from "./Concept.ts"

export class ContentCheck extends Context.Service<
  ContentCheck,
  {
    readonly check: (concept: Concept) => Effect.Effect<ReadonlyArray<string>>
  }
>()("tutor/ContentCheck", {
  make: Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const checker = yield* Checker
    const file = (concept: Concept, name: string) =>
      fs.readFileString(path.join(concept.dir, name)).pipe(Effect.orDie)

    const check = Effect.fn("ContentCheck.check")(function* (concept: Concept) {
      const problems: Array<string> = []
      const test = yield* file(concept, "goal.test.ts")
      const starter = yield* checker.run(
        test,
        yield* file(concept, "starter.ts"),
      )
      if (starter._tag === "Passed")
        problems.push("the starter passes its goal test")
      const solution = yield* checker.run(
        test,
        yield* file(concept, "solution.ts"),
      )
      if (solution._tag !== "Passed")
        problems.push("the solution fails its goal test")
      const { probe } = concept
      for (const item of probe.distractors) {
        if (item.belief.trim() === "")
          problems.push(`distractor "${item.text}" has no wrong belief`)
      }
      if (probe.distractors.some((item) => item.text === probe.correct))
        problems.push("the probe must have exactly one correct option")
      return problems
    })

    return { check }
  }),
}) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(Checker.layer),
  )
}
