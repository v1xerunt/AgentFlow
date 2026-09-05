#!/usr/bin/env node
import { readBundle } from './bundle-tools.mjs'
import { checkForUpdate, updateSkill, skillStatus, skillRoot } from './skill-updates.mjs'
import { setupSkill } from './skill-setup.mjs'
import { parseArgs } from 'node:util'

try {
  const command = process.argv[2] === 'skill' ? process.argv[3] : null
  if (['check-update', 'update', 'status', 'setup'].includes(command)) {
    const { values } = parseArgs({ args: process.argv.slice(4), options: { task: { type: 'string' }, revision: { type: 'string' } } })
    if (command === 'check-update') {
      const result = await checkForUpdate(skillRoot, values.task)
      if (result) process.stdout.write(`${result.message}\n`)
    } else {
      const result = command === 'update' ? await updateSkill(skillRoot, values) : command === 'setup' ? await setupSkill(skillRoot, values) : await skillStatus(skillRoot)
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    }
  } else {
    await readBundle(skillRoot)
    await import(new URL('./agentflow-runtime.mjs', import.meta.url).href)
  }
} catch (error) {
  process.stderr.write(`${JSON.stringify({ error: String(error) })}\n`)
  process.exitCode = 1
}
