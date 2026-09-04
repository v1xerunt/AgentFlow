#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Command } from 'commander'
import { executeGraph, type RuntimeEvent } from '@agentflow/core'
import { formatValidationError, parseGraph } from '@agentflow/schema'
import { registerHostCommands } from './host-commands'

const program = new Command()

async function readGraph(path: string) {
  const invocationDirectory = process.env.INIT_CWD ?? process.cwd()
  const absolutePath = resolve(invocationDirectory, path)
  const source = await readFile(absolutePath, 'utf8')
  return { graph: parseGraph(source), absolutePath }
}

function printEvent(event: RuntimeEvent) {
  const time = event.at.slice(11, 19)
  if (event.type === 'node.status') {
    process.stdout.write(`${time}  ${event.status.padEnd(9)} ${event.nodeId}\n`)
    return
  }
  if (event.type === 'artifact.created') {
    process.stdout.write(`${time}  artifact  ${event.nodeId} → v${event.artifact.version}\n`)
    return
  }
  process.stdout.write(`${time}  ${event.message}\n`)
}

program
  .name('agentflow')
  .description('Run AgentFlow graphs from the command line')
  .version('0.1.0')

program
  .command('validate')
  .argument('<graph>', 'YAML or JSON graph file')
  .option('--json', 'print machine-readable output')
  .action(async (path: string, options: { json?: boolean }) => {
    try {
      const { graph, absolutePath } = await readGraph(path)
      const result = {
        valid: true,
        path: absolutePath,
        name: graph.name,
        nodes: Object.keys(graph.nodes).length,
        links: graph.links.length
      }
      process.stdout.write(options.json ? `${JSON.stringify(result)}\n` : `Valid graph · ${graph.name} · ${result.nodes} nodes · ${result.links} links\n`)
    } catch (error) {
      process.stderr.write(`${formatValidationError(error)}\n`)
      process.exitCode = 1
    }
  })

program
  .command('run')
  .argument('<graph>', 'YAML or JSON graph file')
  .option('--json', 'print the completed run as JSON')
  .option('--no-delay', 'run the fake provider without simulated latency')
  .action(async (path: string, options: { json?: boolean; delay?: boolean }) => {
    try {
      const { graph } = await readGraph(path)
      const result = await executeGraph(graph, {
        delayMs: options.delay === false ? 0 : 420,
        onEvent: options.json ? undefined : printEvent
      })
      if (options.json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
      else process.stdout.write(`\n${result.runId} · ${result.artifacts.length} artifacts · completed\n`)
    } catch (error) {
      process.stderr.write(`${formatValidationError(error)}\n`)
      process.exitCode = 1
    }
  })

registerHostCommands(program)
await program.parseAsync(process.argv)
