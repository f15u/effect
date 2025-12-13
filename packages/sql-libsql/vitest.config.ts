import { defineConfig, mergeConfig } from "vitest/config"
import shared from "../../vitest.shared.js"

const config = defineConfig({
  test: {
    name: "@effect/sql-libsql",
    sequence: { concurrent: false }
  }
})

export default mergeConfig(shared, config)
