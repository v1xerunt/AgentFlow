const { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, chmodSync } = require('node:fs')
const { dirname, join, resolve, relative, isAbsolute } = require('node:path')
const { createRequire } = require('node:module')

const desktop = resolve(__dirname, '..')
const stage = join(desktop, 'release', 'app')
const local = relative(join(desktop, 'release'), stage)
if (!local || local.startsWith('..') || isAbsolute(local)) throw new Error('Invalid release staging path')
const manifest = JSON.parse(readFileSync(join(desktop, 'package.json'), 'utf8'))
const ptyRoot = dirname(require.resolve('node-pty/package.json'))
const platform = `${process.platform}-${process.arch}`
const prebuild = join(ptyRoot, 'prebuilds', platform)
if (!existsSync(prebuild)) throw new Error(`Missing node-pty prebuild for ${platform}`)
if (!existsSync(join(desktop, 'out', 'main', 'index.js'))) throw new Error('Run the desktop build before staging')
rmSync(stage, { recursive: true, force: true })
mkdirSync(stage, { recursive: true })
for (const directory of ['main', 'preload', 'renderer']) cpSync(join(desktop, 'out', directory), join(stage, 'out', directory), { recursive: true })
const notices = ['LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES.md']
for (const name of notices) cpSync(join(desktop, '../..', name), join(stage, name))
require('../../../scripts/collect-licenses.cjs')(desktop, join(stage, 'licenses'))
const ptyTarget = join(stage, 'node_modules', 'node-pty')
mkdirSync(ptyTarget, { recursive: true })
for (const name of ['package.json', 'LICENSE', 'lib']) if (existsSync(join(ptyRoot, name))) cpSync(join(ptyRoot, name), join(ptyTarget, name), { recursive: true })
cpSync(prebuild, join(ptyTarget, 'prebuilds', platform), { recursive: true, filter: path => !path.endsWith('.pdb') })
if (process.platform === 'darwin') chmodSync(join(ptyTarget, 'prebuilds', platform, 'spawn-helper'), 0o755)
const addonRoot = dirname(require.resolve('node-addon-api/package.json', { paths: [ptyRoot] }))
cpSync(addonRoot, join(stage, 'node_modules', 'node-addon-api'), { recursive: true })
// Keep the updater external: its platform loaders resolve files at runtime.
function copyRuntimeDependency(name, from, target) {
  const resolver = createRequire(join(from, 'package.json'))
  const source = (resolver.resolve.paths(name) || []).map(root => join(root, name)).find(root => existsSync(join(root, 'package.json')))
  if (!source) throw new Error(`Missing updater dependency: ${name}`)
  const destination = join(target, 'node_modules', name)
  mkdirSync(dirname(destination), { recursive: true })
  cpSync(source, destination, { recursive: true, filter: file => file === source || !relative(source, file).split(/[\\/]/).includes('node_modules') })
  const dependency = JSON.parse(readFileSync(join(source, 'package.json'), 'utf8'))
  for (const child of Object.keys(dependency.dependencies || {})) copyRuntimeDependency(child, source, destination)
}
copyRuntimeDependency('electron-updater', desktop, stage)
writeFileSync(join(stage, 'package.json'), JSON.stringify({
  name: 'agentflow', version: manifest.version, private: true, type: 'module',
  description: 'AgentFlow desktop workspace for multi-agent workflows',
  homepage: manifest.homepage, repository: manifest.repository,
  author: 'AgentFlow contributors', license: manifest.license, main: manifest.main,
  dependencies: { 'node-pty': manifest.dependencies['node-pty'], 'electron-updater': manifest.dependencies['electron-updater'] }
}, null, 2))
console.log(`Staged ${platform}: ${stage}`)
