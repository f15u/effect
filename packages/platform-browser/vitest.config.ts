import { defineConfig, mergeConfig } from "vitest/config"
import shared from "../../vitest.shared.js"

const config = defineConfig({
  test: {
    name: "@effect/platform-browser",
    environment: "happy-dom"
  }
})

export default mergeConfig(shared, config)
