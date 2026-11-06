import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Layer from "effect/Layer"
import * as Path from "effect/Path"
import type { Concept } from "./Concept.ts"
import { concepts } from "./concepts/index.ts"
import { buildGraph } from "./CurriculumGraph.ts"
import { TutorError } from "./TutorError.ts"

export class Curriculum extends Context.Service<
  Curriculum,
  {
    readonly goals: ReadonlyArray<Concept>
    readonly concept: (id: string) => Concept
    readonly path: (
      goalIds: ReadonlyArray<string>,
      known: ReadonlySet<string>,
    ) => ReadonlyArray<Concept>
    readonly file: (
      concept: Concept,
      name: "starter.ts" | "solution.ts" | "goal.test.ts",
    ) => Effect.Effect<string>
    readonly validateGoals: (
      ids: ReadonlyArray<string>,
    ) => Effect.Effect<void, TutorError>
  }
>()("tutor/Curriculum", {
  make: Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const graph = buildGraph(concepts)
    const byId = new Map<string, Concept>(
      concepts.map((item) => [item.id, item]),
    )
    const goals = concepts.filter((item) => item.goal !== undefined)

    const concept = (id: string) => byId.get(id)!

    const validateGoals = (ids: ReadonlyArray<string>) => {
      const bad = ids.filter((id) => !goals.some((item) => item.id === id))
      return bad.length === 0
        ? Effect.void
        : Effect.fail(
            new TutorError({
              reason: "UnknownGoal",
              message: `Unknown goal: ${bad.join(", ")}. Valid goals: ${goals.map((item) => item.id).join(", ")}.`,
            }),
          )
    }

    return {
      goals,
      concept,
      path: (goalIds, known) => graph.path(goalIds, known).map(concept),
      file: (item, name) =>
        fs.readFileString(path.join(item.dir, name)).pipe(Effect.orDie),
      validateGoals,
    }
  }),
}) {
  static readonly layer = Layer.effect(this, this.make)
}
