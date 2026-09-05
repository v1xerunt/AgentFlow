import { access } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import type { Command } from 'commander'

export function registerSkillCommands(program: Command) {
  program.command('skill').description('Install the independent AgentFlow Skill').command('install')
    .requiredOption('--host <host>', 'codex, claude, or both')
    .option('--project <directory>', 'install for one project')
    .option('--user', 'install for the current user')
    .option('--revision <sha>', 'commit used to obtain this Skill directory')
    .action(async (options: { host: string; project?: string; user?: boolean; revision?: string }) => {
      try {
        const candidates = [new URL('../', import.meta.url), new URL('../../../dist/skills/agentflow/', import.meta.url)]
        const source = await (async () => {
          for (const candidate of candidates) if (await access(new URL('bundle.json', candidate)).then(() => true, () => false)) return candidate
          throw new Error('Use the complete skills/agentflow bundle to install the Skill.')
        })()
        const { installSkill } = await import(new URL('scripts/skill-setup.mjs', source).href)
        process.stdout.write(`${JSON.stringify(await installSkill({ ...options, source: fileURLToPath(source) }), null, 2)}\n`)
      } catch (error) {
        process.stderr.write(`${JSON.stringify({ error: String(error) })}\n`)
        process.exitCode = 1
      }
    })
}
