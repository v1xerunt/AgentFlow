const assert = require('node:assert/strict')
const { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } = require('node:fs')
const { dirname, join } = require('node:path')
const { sync: spawnSync } = require('cross-spawn')

module.exports = function smokeDesktopCli(executable, root) {
  const resources = join(dirname(executable), process.platform === 'darwin' ? '../Resources' : 'resources', 'agentflow')
  const launcher = join(resources, process.platform === 'win32' ? 'agentflow.cmd' : 'agentflow')
  const project = join(root, 'Skill project 空格 & symbols')
  mkdirSync(project)
  const env = { ...process.env, PATH: '', Path: '', HOME: root, USERPROFILE: root }
  delete env.INIT_CWD
  delete env.ELECTRON_RUN_AS_NODE
  const call = (command, args, failure = false) => {
    const result = spawnSync(command, args, { cwd: project, env, encoding: 'utf8', windowsHide: true, timeout: 15_000 })
    if (failure) { assert.notEqual(result.status, 0); return result }
    assert.equal(result.status, 0, result.stderr || String(result.error))
    return JSON.parse(result.stdout)
  }
  // The application has exited. Every command must work without Node on PATH.
  const installed = call(launcher, ['skill', 'install', '--host', 'both', '--project', project])
  assert.equal(installed.runtime, 'desktop')
  for (const host of ['.agents', '.claude']) {
    const skill = join(project, host, 'skills/agentflow')
    const command = join(skill, 'scripts', process.platform === 'win32' ? 'agentflow.cmd' : 'agentflow')
    const graph = join(skill, 'assets/review-flow.json')
    assert.equal(call(command, ['host', 'validate', graph]).valid, true)
    const run = join(project, `${host}-run`)
    call(command, ['host', 'start', graph, '--workspace', project, '--run-dir', run])
    let state = call(command, ['host', 'status', run])
    for (let step = 0; state.status !== 'completed' && step < 10; step++) {
      const task = call(command, ['host', 'next', run])
      assert.ok(task.task)
      writeFileSync(task.resultPath, `Offline packaged CLI test fixture for ${task.node.id}.`)
      state = call(command, ['host', 'submit', run, task.task.id, '--file', task.resultPath])
    }
    assert.equal(state.status, 'completed')
    call(command, ['host', 'panel', run, '--out', join(project, `${host}.html`)])
    assert.ok(existsSync(join(project, `${host}.html`)))
    call(command, ['host', 'validate', join(project, 'missing.json')], true)
  }
  const protectedFile = join(project, '.agents/skills/agentflow/SKILL.md')
  writeFileSync(protectedFile, 'User-maintained Skill')
  call(launcher, ['skill', 'install', '--host', 'both', '--project', project], true)
  assert.equal(readFileSync(protectedFile, 'utf8'), 'User-maintained Skill')
  assert.equal(existsSync(join(root, '.agents')), false)
  assert.equal(existsSync(join(root, '.claude')), false)
  if (process.platform === 'linux') {
    const directory = dirname(dirname(executable))
    const image = readdirSync(directory).find(name => name.endsWith('.AppImage'))
    assert.ok(image, 'The AppImage must be built before the packaged CLI check')
    const imageProject = join(root, 'AppImage Skill project')
    const imageEnv = { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
    delete imageEnv.INIT_CWD
    delete imageEnv.DISPLAY
    const bootstrap = 'const p=require("node:path");const f=p.join(p.dirname(process.execPath),"resources/agentflow/cli/index.js");process.argv.splice(1,0,f);import(require("node:url").pathToFileURL(f).href)'
    const install = spawnSync(join(directory, image), ['--eval', bootstrap, '--', 'skill', 'install', '--host', 'codex', '--project', imageProject], { env: imageEnv, encoding: 'utf8', timeout: 20_000 })
    assert.equal(install.status, 0, install.stderr)
    const skill = join(imageProject, '.agents/skills/agentflow')
    const result = spawnSync(join(skill, 'scripts/agentflow'), ['host', 'validate', join(skill, 'assets/review-flow.json')], { env: imageEnv, encoding: 'utf8', timeout: 20_000 })
    assert.equal(result.status, 0, result.stderr)
    assert.equal(JSON.parse(result.stdout).valid, true)
  }
  return { desktopClosed: true, nodeOnPath: false, hosts: ['codex', 'claude'], completedFlows: 2 }
}
