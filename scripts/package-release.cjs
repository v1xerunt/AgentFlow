const { cpSync, mkdirSync, readdirSync, readFileSync, writeFileSync, statSync } = require('node:fs')
const { join, resolve } = require('node:path')
const { createHash } = require('node:crypto')
const { execFileSync } = require('node:child_process')
const { releaseMetadata, repository } = require('./release-metadata.cjs')

function installerNames(version, platform) {
  const suffixes = {
    win32: ['windows-x64-setup.exe'],
    darwin: ['mac-mchip-arm64.dmg', 'mac-mchip-arm64.zip'],
    linux: ['linux-x64.AppImage', 'linux-x64.deb']
  }
  if (!suffixes[platform]) throw new Error(`Unsupported release platform: ${platform}`)
  return suffixes[platform].map(suffix => `AgentFlow-${version}-${suffix}`)
}

function updateAssetNames(version, platform) {
  const metadata = platform === 'win32' ? 'latest.yml' : platform === 'darwin' ? 'latest-mac.yml' : 'latest-linux.yml'
  const blockmaps = installerNames(version, platform).filter(name => /\.(exe|zip)$/.test(name)).map(name => `${name}.blockmap`)
  return [metadata, ...blockmaps]
}

function verifyUpdateMetadata(directory, version, platform) {
  const { parse } = require('yaml')
  const metadata = parse(readFileSync(join(directory, updateAssetNames(version, platform)[0]), 'utf8'))
  if (metadata?.version !== version || !Array.isArray(metadata.files) || !metadata.files.length) throw new Error('Invalid update metadata version or files')
  const expected = installerNames(version, platform)
  const primary = expected.find(name => /\.(exe|zip|AppImage)$/.test(name))
  if (!metadata.files.some(file => file.url === primary)) throw new Error('Missing primary update installer')
  for (const file of metadata.files) {
    if (!expected.includes(file.url)) throw new Error('Unexpected update download URL')
    const data = readFileSync(join(directory, file.url))
    if (createHash('sha512').update(data).digest('base64') !== file.sha512 || data.length !== file.size) throw new Error('Update checksum or size mismatch')
  }
}

function checkAssets(directory, version) {
  const expected = [
    ...['win32', 'darwin', 'linux'].flatMap(platform => [...installerNames(version, platform), ...updateAssetNames(version, platform)]),
    `AgentFlow-${version}-cli.tar.gz`, `AgentFlow-${version}-skill.tar.gz`, `AgentFlow-${version}-source.tar.gz`
  ]
  for (const file of expected) if (!statSync(join(directory, file)).isFile() || !statSync(join(directory, file)).size) throw new Error(`Empty release asset: ${file}`)
  const archives = readdirSync(directory).filter(file => /\.(exe|dmg|zip|AppImage|deb|tar\.gz|yml|blockmap)$/.test(file))
  if (archives.sort().join('\n') !== expected.sort().join('\n')) throw new Error('Unexpected or stale release assets')
  for (const platform of ['win32', 'darwin', 'linux']) verifyUpdateMetadata(directory, version, platform)
  return expected
}

function packageRelease(mode) {
  const { version } = releaseMetadata()
  const output = resolve(repository, 'dist/release')
  mkdirSync(output, { recursive: true })
  const command = (name, args) => execFileSync(name, args, { cwd: repository, stdio: 'inherit', windowsHide: true })
  if (mode === 'desktop') {
    const architecture = process.platform === 'darwin' ? 'arm64' : 'x64'
    if (process.arch !== architecture) throw new Error(`Expected native ${architecture} build`)
    for (const name of [...installerNames(version, process.platform), ...updateAssetNames(version, process.platform)]) {
      const source = join(repository, 'apps/desktop/release/installers', name)
      if (!statSync(source).size) throw new Error(`Empty installer: ${name}`)
      cpSync(source, join(output, name))
    }
    writeFileSync(join(output, `build-${process.platform}.json`), JSON.stringify({
      version, commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repository, encoding: 'utf8', windowsHide: true }).trim(),
      platform: process.platform, arch: process.arch, node: process.version,
      electron: require('electron/package.json').version,
      signed: process.platform !== 'linux' && process.env.AGENTFLOW_REQUIRE_SIGNING === '1'
    }, null, 2) + '\n')
  } else if (mode === 'portable') {
    command('tar', ['-czf', join(output, `AgentFlow-${version}-cli.tar.gz`), '-C', join(repository, 'apps/cli'), 'dist'])
    command('tar', ['-czf', join(output, `AgentFlow-${version}-skill.tar.gz`), '-C', join(repository, 'dist/skills'), 'agentflow'])
  } else if (mode === 'assemble') {
    command('git', ['archive', '--format=tar.gz', `--prefix=AgentFlow-${version}/`, `--output=${join(output, `AgentFlow-${version}-source.tar.gz`)}`, 'HEAD'])
    const files = checkAssets(output, version)
    const builds = ['win32', 'darwin', 'linux'].map(platform => JSON.parse(readFileSync(join(output, `build-${platform}.json`), 'utf8')))
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repository, encoding: 'utf8', windowsHide: true }).trim()
    for (const [index, build] of builds.entries()) {
      const platform = ['win32', 'darwin', 'linux'][index]
      if (build.version !== version || build.commit !== commit || build.platform !== platform || build.arch !== (platform === 'darwin' ? 'arm64' : 'x64')) throw new Error('Build provenance mismatch')
    }
    writeFileSync(join(output, 'BUILD_INFO.json'), JSON.stringify({ version, commit, builds }, null, 2) + '\n')
    writeFileSync(join(output, 'SHA256SUMS.txt'), [...files, 'BUILD_INFO.json'].sort().map(file => `${createHash('sha256').update(readFileSync(join(output, file))).digest('hex')}  ${file}`).join('\n') + '\n')
    const unsigned = builds.some(build => build.platform !== 'linux' && !build.signed)
    const notes = require('./release-notes.cjs')({ version, commit, unsigned })
    writeFileSync(join(output, 'RELEASE_NOTES.md'), notes)
  } else throw new Error('Use desktop, portable or assemble')
}
if (require.main === module) packageRelease(process.argv[2])
module.exports = { installerNames, updateAssetNames, verifyUpdateMetadata, checkAssets, packageRelease }
