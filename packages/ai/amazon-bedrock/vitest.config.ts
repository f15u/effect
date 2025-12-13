import { defineConfig, mergeConfig } from "vitest/config"
import shared from "../../../vitest.shared.js"

const config = defineConfig({
  test: {
    name: "@effect/ai-amazon-bedrock"
  }
})

export default mergeConfig(shared, config)
