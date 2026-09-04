const { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } = require('node:fs')
const { createRequire } = require('node:module')
const { join } = require('node:path')

module.exports = function collectLicenses(packageDirectory, output) {
  mkdirSync(output, { recursive: true })
  const visited = new Set()
  const index = []
  function visit(root) {
    root = realpathSync(root)
    if (visited.has(root)) return
    visited.add(root)
    const file = join(root, 'package.json')
    const manifest = JSON.parse(readFileSync(file, 'utf8'))
    const licenseFiles = readdirSync(root, { withFileTypes: true }).filter(entry => entry.isFile() && /^(licen[sc]e|copying|notice)(?:[.-]|$)/i.test(entry.name))
    if (!manifest.name.startsWith('@agentflow/')) {
      const folder = `${manifest.name.replaceAll('/', '__')}-${manifest.version}`
      mkdirSync(join(output, folder), { recursive: true })
      for (const entry of licenseFiles) cpSync(join(root, entry.name), join(output, folder, entry.name))
      index.push({ name: manifest.name, version: manifest.version, license: manifest.license, files: licenseFiles.map(entry => `${folder}/${entry.name}`) })
    }
    const resolver = createRequire(file)
    for (const dependency of Object.keys(manifest.dependencies ?? {})) {
      const packageRoot = (resolver.resolve.paths('__agentflow_dependency__') ?? []).map(path => join(path, dependency)).find(path => existsSync(join(path, 'package.json')))
      if (!packageRoot) throw new Error(`Missing production dependency: ${dependency}`)
      visit(packageRoot)
    }
  }
  visit(packageDirectory)
  const fonts = join(packageDirectory, 'src/renderer/src/assets/fonts')
  if (existsSync(fonts)) {
    mkdirSync(join(output, 'fonts'), { recursive: true })
    for (const name of readdirSync(fonts).filter(name => name.startsWith('LICENSE-'))) cpSync(join(fonts, name), join(output, 'fonts', name))
  }
  writeFileSync(join(output, 'index.json'), JSON.stringify(index.sort((a, b) => a.name.localeCompare(b.name)), null, 2))
}
