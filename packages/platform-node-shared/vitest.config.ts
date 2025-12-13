import { defineConfig, mergeConfig } from "vitest/config"
import shared from "../../vitest.shared.js"

const config = defineConfig({
  test: {
    name: "@effect/platform-node-shared"
  }
})

export default mergeConfig(shared, config)
