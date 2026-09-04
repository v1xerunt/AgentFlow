#!/usr/bin/env node
import { existsSync } from 'node:fs'

const bundled = new URL('./agentflow-runtime.mjs', import.meta.url)
const checkout = new URL('../../../apps/cli/dist/index.js', import.meta.url)
const runtime = existsSync(bundled) ? bundled : existsSync(checkout) ? checkout : null
if (!runtime) {
  process.stderr.write('AgentFlow runtime missing. In the source checkout run: npm run build --workspace @agentflow/cli. For installation, use the complete package from npm run skill:build.\n')
  process.exitCode = 1
} else {
  await import(runtime.href)
}
