#!/usr/bin/env node
import { existsSync } from 'node:fs'

const bundled = new URL('./agentflow-runtime.mjs', import.meta.url)
const checkout = new URL('../../../apps/cli/dist/index.js', import.meta.url)
const runtime = existsSync(bundled) ? bundled : existsSync(checkout) ? checkout : null
if (!runtime) {
  process.stderr.write('AgentFlow compiled CLI is missing. Follow references/installation.md to install the complete released Skill or reuse an installed desktop CLI. For a source checkout, run npm run skill:build.\n')
  process.exitCode = 1
} else {
  await import(runtime.href)
}
