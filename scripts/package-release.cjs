const { cpSync, mkdirSync, readdirSync, readFileSync, writeFileSync, statSync } = require('node:fs')
const { join, resolve } = require('node:path')
const { createHash } = require('node:crypto')
const { execFileSync } = require('node:child_process')
const { releaseMetadata, repository } = require('./release-metadata.cjs')

function installerNames(version, platform) {
  const suffixes = {
    win32: ['win-x64.exe'],
    darwin: ['mac-arm64.dmg', 'mac-arm64.zip'],
    linux: ['linux-x64.AppImage', 'linux-x64.deb']
  }
  if (!suffixes[platform]) throw new Error(`Unsupported release platform: ${platform}`)
  return suffixes[platform].map(suffix => `AgentFlow-${version}-${suffix}`)
}

function checkAssets(directory, version) {
  const expected = [
    ...['win32', 'darwin', 'linux'].flatMap(platform => installerNames(version, platform)),
    `AgentFlow-${version}-cli.tar.gz`, `AgentFlow-${version}-skill.tar.gz`, `AgentFlow-${version}-source.tar.gz`
  ]
  for (const file of expected) if (!statSync(join(directory, file)).isFile() || !statSync(join(directory, file)).size) throw new Error(`Empty release asset: ${file}`)
  const archives = readdirSync(directory).filter(file => /\.(exe|dmg|zip|AppImage|deb|tar\.gz)$/.test(file))
  if (archives.sort().join('\n') !== expected.sort().join('\n')) throw new Error('Unexpected or stale release assets')
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
    for (const name of installerNames(version, process.platform)) {
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
    const notes = `# AgentFlow ${version}\n\nVisual multi-agent workflows for LLMs and coding agents. / 面向 LLM 与编程 Agent 的可视化多智能体工作流。\n\n| Platform / 平台 | Download / 下载 | Install / 安装 |\n| --- | --- | --- |\n| Windows x64 | \`.exe\` | Run the installer / 双击安装 |\n| macOS 13+, Apple Silicon | \`.dmg\` | Drag AgentFlow to Applications / 拖入应用程序 |\n| Linux x64 | \`.AppImage\` | Make executable and run / 赋予执行权限后运行 |\n| Debian / Ubuntu x64 | \`.deb\` | Install with the system package installer / 使用系统安装器 |\n\nThe desktop app includes its runtime. External Agent tools may need installation and account access. / 桌面应用自带运行时，外部 Agent 工具可能需要安装和账户权限。\n\n${unsigned ? 'These builds use unsigned Windows packaging and ad-hoc macOS signing. For a trusted download, Windows may offer More info → Run anyway; macOS may offer System Settings → Privacy & Security → Open Anyway. Managed devices can restrict these options. / 本批构建使用未签名 Windows 包及 macOS 临时签名。确认下载可信后，可按系统提示选择继续运行；受管理设备可能限制此操作。' : 'Windows packages are code-signed. macOS packages use Developer ID signing and Apple notarization. / Windows 包已签名，macOS 包已使用 Developer ID 签名并完成 Apple 公证。'}\n\nThe CLI and skill archives include their matching runtime and licenses; Node.js 22.13+ is required. The skill and CLI source are also included in this repository. / CLI 和 skill 附件包含配套运行时及许可文件，需要 Node.js 22.13+；仓库同时提供二者源码。\n\nCorresponding source: \`AgentFlow-${version}-source.tar.gz\`. License: AGPL-3.0-only. Verify downloads with \`SHA256SUMS.txt\`; build details are in \`BUILD_INFO.json\`. / 对应源码、许可证、校验值及构建信息随版本提供。\n\nCommit: \`${commit}\`\n`
    writeFileSync(join(output, 'RELEASE_NOTES.md'), notes)
  } else throw new Error('Use desktop, portable or assemble')
}
if (require.main === module) packageRelease(process.argv[2])
module.exports = { installerNames, checkAssets, packageRelease }
