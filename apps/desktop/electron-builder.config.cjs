// Actions provides empty strings for optional secrets; builders treat CSC_LINK
// as a certificate path whenever the environment variable is present.
if (process.env.CSC_LINK === '') delete process.env.CSC_LINK
const signed = process.env.AGENTFLOW_REQUIRE_SIGNING === '1'
if (signed && process.platform !== 'linux' && !process.env.CSC_LINK) throw new Error('A signing certificate (CSC_LINK) is required for release builds')
if (signed && process.platform === 'darwin' && !(process.env.APPLE_ID && process.env.APPLE_APP_SPECIFIC_PASSWORD && process.env.APPLE_TEAM_ID)) throw new Error('Apple notarization credentials are required for release builds')
const artifactPlatform = { win32: 'win', darwin: 'mac', linux: 'linux' }[process.platform]
if (!artifactPlatform || !['x64', 'arm64'].includes(process.arch)) throw new Error(`Unsupported release target: ${process.platform}-${process.arch}`)

module.exports = {
  appId: 'com.agentflow.desktop',
  productName: 'AgentFlow',
  electronVersion: require('electron/package.json').version,
  directories: { app: 'release/app', output: 'release/installers' },
  files: ['out/**/*', 'package.json', 'LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES.md', 'licenses/**/*'],
  asar: true,
  asarUnpack: ['node_modules/node-pty/**/*'],
  // node-pty 1.2 ships Node-API prebuilds. stage-release copies the host build;
  // the packaged PTY smoke test is required on every release runner.
  npmRebuild: false,
  artifactName: `AgentFlow-\${version}-${artifactPlatform}-${process.arch}.\${ext}`,
  publish: { provider: 'github', owner: 'v1xerunt', repo: 'AgentFlow', releaseType: 'release' },
  extraMetadata: { agentflowSigned: signed },
  forceCodeSigning: signed && process.platform !== 'linux',
  win: { target: [{ target: 'nsis', arch: ['x64'] }], artifactName: 'AgentFlow-${version}-windows-x64-setup.${ext}', icon: 'src/assets/app-icon.ico' },
  nsis: { oneClick: false, allowToChangeInstallationDirectory: true, perMachine: false, deleteAppDataOnUninstall: false },
  mac: { target: [{ target: 'dmg', arch: ['arm64'] }, { target: 'zip', arch: ['arm64'] }], artifactName: 'AgentFlow-${version}-mac-mchip-arm64.${ext}', icon: 'src/assets/app-icon.png', category: 'public.app-category.productivity', minimumSystemVersion: '13.0', identity: process.env.CSC_LINK || process.env.CSC_NAME ? undefined : '-', hardenedRuntime: true, entitlements: 'build/entitlements.mac.plist', entitlementsInherit: 'build/entitlements.mac.plist', notarize: signed },
  linux: { target: [{ target: 'AppImage', arch: ['x64'] }, { target: 'deb', arch: ['x64'] }], icon: 'src/assets/app-icon.png', category: 'Development', maintainer: 'AgentFlow' }
}
