const assert = require('node:assert/strict')
const { mkdtempSync, copyFileSync, rmSync, chmodSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { basename, dirname, join, resolve } = require('node:path')
const { spawnSync } = require('node:child_process')
const root = mkdtempSync(join(tmpdir(), 'agentflow-cli-'))
try {
  const cli = join(root, 'agentflow.mjs')
  copyFileSync(resolve(__dirname, '../apps/cli/dist/index.js'), cli)
  copyFileSync(resolve(__dirname, '../examples/review-flow.yaml'), join(root, '流程 with spaces.yaml'))
  chmodSync(cli, 0o755)
  const env = { ...process.env }
  delete env.INIT_CWD
  delete env.NODE_PATH
  for (const args of [['validate', '流程 with spaces.yaml', '--json'], ['run', '流程 with spaces.yaml', '--no-delay', '--json']]) {
    const result = spawnSync(process.execPath, [cli, ...args], { cwd: root, env, encoding: 'utf8', windowsHide: true, timeout: 20_000 })
    assert.equal(result.status, 0, result.stderr || String(result.error))
    assert.ok(JSON.parse(result.stdout))
  }
  console.log('Standalone CLI validated outside the repository')
} finally {
  if (dirname(root) === resolve(tmpdir()) && basename(root).startsWith('agentflow-cli-')) rmSync(root, { recursive: true, force: true })
}
