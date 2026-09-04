const { spawn } = require('node:child_process')
const { mkdtempSync, readFileSync, rmSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { basename, dirname, join, resolve } = require('node:path')

const root = mkdtempSync(join(tmpdir(), 'agentflow-release-smoke-'))
const defaults = { win32: 'win-unpacked/AgentFlow.exe', darwin: 'mac-arm64/AgentFlow.app/Contents/MacOS/AgentFlow', linux: 'linux-unpacked/agentflow' }
const executable = process.argv[2] ? resolve(process.argv[2]) : resolve(__dirname, '../release/installers', defaults[process.platform])
const env = { ...process.env, AGENTFLOW_RELEASE_SMOKE: root }
delete env.ELECTRON_RUN_AS_NODE
delete env.ELECTRON_RENDERER_URL
const child = spawn(executable, [], { env, stdio: 'inherit', windowsHide: true, timeout: 45_000 })
child.once('error', error => { console.error(error); process.exitCode = 1 })
child.once('close', code => {
  try {
    const report = JSON.parse(readFileSync(join(root, 'report.json'), 'utf8'))
    console.log(JSON.stringify(report, null, 2))
    if (code !== 0 || !report.ok || !report.packaged || report.platform !== process.platform || report.arch !== process.arch) process.exitCode = 1
  } catch (error) { console.error(error); process.exitCode = 1 }
  finally {
    if (dirname(resolve(root)) === resolve(tmpdir()) && basename(root).startsWith('agentflow-release-smoke-')) rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  }
})
