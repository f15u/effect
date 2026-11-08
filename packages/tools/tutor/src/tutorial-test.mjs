import assert from "node:assert/strict"

const cases = []
let scheduled = false

export { assert }

export const it = (name, fn) => {
  cases.push({ name, fn })
  if (!scheduled) {
    scheduled = true
    setImmediate(run)
  }
}

async function run() {
  const results = []
  for (const { name, fn } of cases) {
    try {
      await fn()
      results.push({ name, passed: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      results.push({ name, passed: false, message })
    }
  }
  process.stdout.write(`TUTOR_RESULT ${JSON.stringify(results)}\n`)
}
