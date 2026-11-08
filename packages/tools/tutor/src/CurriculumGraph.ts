import * as Graph from "effect/Graph"
import type { Concept } from "./Concept.ts"

export interface CurriculumGraph {
  readonly path: (
    goalIds: ReadonlyArray<string>,
    known: ReadonlySet<string>
  ) => ReadonlyArray<string>
}

export const buildGraph = (
  concepts: ReadonlyArray<Concept>
): CurriculumGraph => {
  const indexOf = new Map<string, number>()
  const idOf = new Map<number, string>()
  const graph = Graph.directed<string, string>((mutable) => {
    for (const concept of concepts) {
      const index = Graph.addNode(mutable, concept.id)
      indexOf.set(concept.id, index)
      idOf.set(index, concept.id)
    }
    for (const concept of concepts) {
      for (const need of concept.needs) {
        Graph.addEdge(
          mutable,
          indexOf.get(need.id)!,
          indexOf.get(concept.id)!,
          "needs"
        )
      }
    }
  })
  const order = Array.from(Graph.indices(Graph.topo(graph)), (index) => idOf.get(index)!)

  const path = (goalIds: ReadonlyArray<string>, known: ReadonlySet<string>) => {
    const wanted = new Set(
      Graph.indices(
        Graph.dfs(graph, {
          start: goalIds.map((id) => indexOf.get(id)!),
          direction: "incoming"
        })
      )
    )
    return order.filter((id) => wanted.has(indexOf.get(id)!) && !known.has(id))
  }

  return { path }
}
