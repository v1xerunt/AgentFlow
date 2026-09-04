import { readFile, stat, writeFile } from 'node:fs/promises'
import { Command } from 'commander'
import { claimHostTask, failHostTask, retryHostTask, submitHostTask, validateHostGraph } from '@agentflow/core/host-run'
import { formatValidationError, parseGraph } from '@agentflow/schema'
import { describeHostRun, describeHostTask, invocationPath, newTaskId, readHostRun, startHostRun, withHostRun } from './host-storage'
import { createHostPanel } from './host-panel'

function action<T extends unknown[]>(callback: (...args: T) => Promise<unknown>) {
  return async (...args: T) => {
    try { process.stdout.write(JSON.stringify(await callback(...args), null, 2) + '\n') }
    catch (error) { process.stderr.write(JSON.stringify({ error: formatValidationError(error) }) + '\n'); process.exitCode = 1 }
  }
}

export function registerHostCommands(program: Command) {
  const host = program.command('host').description('Execute a Flow with the current coding-agent session; every command returns JSON')
  host.command('validate').argument('<graph>').action(action(async (path: string) => {
    const graph = validateHostGraph(parseGraph(await readFile(invocationPath(path), 'utf8')))
    return { valid: true, name: graph.name, nodes: Object.keys(graph.nodes).length }
  }))
  host.command('start').argument('<graph>')
    .option('--workspace <directory>', 'working directory for host Agents', '.')
    .option('--run-dir <directory>', 'allocate a new run at this path')
    .action(action(async (path: string, options: { workspace: string; runDir?: string }) => {
      const graph = validateHostGraph(parseGraph(await readFile(invocationPath(path), 'utf8')))
      return startHostRun(graph, invocationPath(options.workspace), options.runDir ? invocationPath(options.runDir) : undefined)
    }))
  host.command('status').argument('<run>').action(action(async (path: string) => {
    const directory = invocationPath(path)
    return describeHostRun(directory, await readHostRun(directory))
  }))
  host.command('next').argument('<run>').option('--node <id>', 'claim a particular ready Agent')
    .action(action(async (path: string, options: { node?: string }) => {
      const directory = invocationPath(path)
      return withHostRun(directory, run => {
        const claimed = claimHostTask(run, newTaskId(), new Date().toISOString(), options.node)
        return claimed ? describeHostTask(directory, run, claimed.task) : { task: null, ...describeHostRun(directory, run) }
      })
    }))
  host.command('request').argument('<run>').argument('<task>')
    .action(action(async (path: string, id: string) => {
      const directory = invocationPath(path)
      const run = await readHostRun(directory)
      const task = run.tasks.find(task => task.id === id)
      if (!task || task.status !== 'running') throw new Error('Task is not running. Inspect host status.')
      return describeHostTask(directory, run, task)
    }))
  host.command('submit').argument('<run>').argument('<task>').requiredOption('--file <path>', 'UTF-8 Markdown result file')
    .action(action(async (path: string, taskId: string, options: { file: string }) => {
      const content = await readFile(invocationPath(options.file), 'utf8')
      const directory = invocationPath(path)
      return withHostRun(directory, run => {
        const artifact = submitHostTask(run, taskId, content, new Date().toISOString())
        return { artifactId: artifact.id, ...describeHostRun(directory, run) }
      })
    }))
  host.command('fail').argument('<run>').argument('<task>').requiredOption('--reason <text>', 'why execution stopped')
    .action(action(async (path: string, taskId: string, options: { reason: string }) => {
      const directory = invocationPath(path)
      return withHostRun(directory, run => {
        failHostTask(run, taskId, options.reason, new Date().toISOString())
        return describeHostRun(directory, run)
      })
    }))
  host.command('retry').argument('<run>').argument('<node>')
    .action(action(async (path: string, nodeId: string) => {
      const directory = invocationPath(path)
      return withHostRun(directory, run => {
        const claimed = retryHostTask(run, nodeId, newTaskId(), new Date().toISOString())
        return describeHostTask(directory, run, claimed.task)
      })
    }))
  host.command('panel').argument('<graph-or-run>').requiredOption('--out <html>', 'write a standalone HTML panel')
    .action(action(async (path: string, options: { out: string }) => {
      const source = invocationPath(path)
      const run = (await stat(source)).isDirectory() ? await readHostRun(source) : undefined
      const graph = run?.graph ?? validateHostGraph(parseGraph(await readFile(source, 'utf8')))
      const output = invocationPath(options.out)
      if (output === source) throw new Error('Panel output must be a new HTML file.')
      await writeFile(output, createHostPanel(graph, run), { encoding: 'utf8', flag: 'wx' })
      return { panelPath: output, mode: run ? 'run-snapshot' : 'edit', name: graph.name }
    }))
}
