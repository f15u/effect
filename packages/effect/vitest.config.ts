import { defineConfig, mergeConfig } from "vitest/config"
import shared from "../../vitest.shared.js"

const config = defineConfig({
  test: {
    name: "effect",
    coverage: {
      reporter: ["html"],
      include: ["src/Schema.ts"]
    }
  }
})

export default mergeConfig(shared, config)
