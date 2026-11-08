import * as fs from "node:fs"
import * as path from "node:path"

const src = path.join(import.meta.dirname, "src")
const dist = path.join(import.meta.dirname, "dist")
const assets = /(^tutorial-test\.mjs$)|(\/(starter|solution|goal\.test)\.ts$)/

fs.cpSync(src, dist, {
  recursive: true,
  filter: (file) => {
    if (fs.statSync(file).isDirectory()) return true
    return assets.test(path.relative(src, file))
  },
})
