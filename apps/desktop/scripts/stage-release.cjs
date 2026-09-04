const { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, chmodSync } = require('node:fs')
const { dirname, join, resolve, relative, isAbsolute } = require('node:path')

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
cpSync(join(desktop, 'out'), join(stage, 'out'), { recursive: true })
const notices = ['LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES.md']
for (const name of notices) cpSync(join(desktop, '../..', name), join(stage, name))
require('../../../scripts/collect-licenses.cjs')(desktop, join(stage, 'licenses'))
const ptyTarget = join(stage, 'node_modules', 'node-pty')
mkdirSync(ptyTarget, { recursive: true })
for (const name of ['package.json', 'LICENSE', 'lib']) if (existsSync(join(ptyRoot, name))) cpSync(join(ptyRoot, name), join(ptyTarget, name), { recursive: true })
cpSync(prebuild, join(ptyTarget, 'prebuilds', platform), { recursive: true, filter: path => !path.endsWith('.pdb') })
if (process.platform !== 'win32') chmodSync(join(ptyTarget, 'prebuilds', platform, 'spawn-helper'), 0o755)
const addonRoot = dirname(require.resolve('node-addon-api/package.json', { paths: [ptyRoot] }))
cpSync(addonRoot, join(stage, 'node_modules', 'node-addon-api'), { recursive: true })
writeFileSync(join(stage, 'package.json'), JSON.stringify({
  name: 'agentflow', version: manifest.version, private: true, type: 'module',
  description: 'AgentFlow desktop workspace for multi-agent workflows',
  homepage: manifest.homepage, repository: manifest.repository,
  author: 'AgentFlow contributors', license: manifest.license, main: manifest.main,
  dependencies: { 'node-pty': manifest.dependencies['node-pty'] }
}, null, 2))
console.log(`Staged ${platform}: ${stage}`)
