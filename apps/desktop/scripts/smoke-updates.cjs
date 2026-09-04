const fs = require('node:fs')
const path = require('node:path')
if (!process.versions.electron) {
  const { spawnSync } = require('node:child_process')
  const root = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'agentflow-update-smoke-'))
  const env = { ...process.env, AGENTFLOW_UPDATE_SMOKE_ROOT: root }; delete env.ELECTRON_RUN_AS_NODE
  const result = spawnSync(require('electron'), [__filename], { env, stdio: 'inherit', windowsHide: true, timeout: 90_000 })
  if (result.error) console.error(result.error)
  if (path.dirname(root) === path.resolve(require('node:os').tmpdir()) && path.basename(root).startsWith('agentflow-update-smoke-')) fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  process.exit(result.status ?? 1)
}
const { app, session } = require('electron')
const { createServer } = require('node:http')
const { NsisUpdater } = require('electron-updater')
const { ElectronHttpExecutor, getNetSession } = require('electron-updater/out/electronHttpExecutor')
const { parse, stringify } = require('yaml')
const assert = require('node:assert/strict')
const root = path.resolve(process.env.AGENTFLOW_UPDATE_SMOKE_ROOT || '')
if (path.dirname(root) !== path.resolve(require('node:os').tmpdir()) || !path.basename(root).startsWith('agentflow-update-smoke-')) throw new Error('Invalid smoke directory')
app.setPath('userData', path.join(root, 'electron'))
async function main() {
  await app.whenReady()
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !details.url.startsWith('http://127.0.0.1:') }))
  getNetSession().webRequest.onBeforeRequest((details, callback) => callback({ cancel: !details.url.startsWith('http://127.0.0.1:') }))
  const installers = path.resolve(__dirname, '../release/installers')
  const metadata = parse(fs.readFileSync(path.join(installers, 'latest.yml'), 'utf8'))
  let corrupt = false
  const server = createServer((request, response) => {
    const name = new URL(request.url, 'http://localhost').pathname.slice(1)
    if (name === 'latest.yml') {
      const value = structuredClone(metadata)
      if (corrupt) { value.files[0].sha512 = Buffer.alloc(64).toString('base64'); value.sha512 = value.files[0].sha512 }
      response.end(stringify(value)); return
    }
    if (name !== metadata.files[0].url) { response.writeHead(404); response.end(); return }
    response.setHeader('Content-Length', fs.statSync(path.join(installers, name)).size)
    fs.createReadStream(path.join(installers, name)).pipe(response)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const url = `http://127.0.0.1:${server.address().port}`
  const makeClient = name => {
    const userDataPath = path.join(root, name); fs.mkdirSync(userDataPath, { recursive: true })
    const appUpdateConfigPath = path.join(userDataPath, 'app-update.yml')
    fs.writeFileSync(appUpdateConfigPath, stringify({ provider: 'generic', url, updaterCacheDirName: name }))
    const client = new NsisUpdater({ provider: 'generic', url }, {
      name, version: '0.0.0', isPackaged: true, appUpdateConfigPath, userDataPath, baseCachePath: userDataPath,
      whenReady: async () => {}, quit() { throw new Error('Test must not quit to install') }, relaunch() { throw new Error('Test must not relaunch') }, onQuit() { throw new Error('Test must not register installation') }
    })
    client.autoDownload = false; client.autoInstallOnAppQuit = false; client.disableDifferentialDownload = true; client.disableWebInstaller = true; client.logger = null
    client.httpExecutor = new ElectronHttpExecutor()
    client.setFeedURL({ provider: 'generic', url })
    client.on('error', () => {})
    return client
  }
  try {
    const valid = makeClient('valid'), progress = []
    valid.on('download-progress', value => progress.push(value.percent))
    const result = await valid.checkForUpdates()
    assert.equal(result.updateInfo.version, metadata.version)
    const downloaded = await valid.downloadUpdate()
    assert.equal(fs.statSync(downloaded[0]).size, metadata.files[0].size)
    assert.ok(progress.length > 0)
    corrupt = true
    const invalid = makeClient('invalid'); await invalid.checkForUpdates()
    await assert.rejects(invalid.downloadUpdate(), /checksum|sha512/i)
    console.log(JSON.stringify({ realUpdater: true, availableVersion: metadata.version, downloadBytes: metadata.files[0].size, progressEvents: progress.length, checksumMismatchRejected: true, installed: false }, null, 2))
  } finally { await new Promise(resolve => server.close(resolve)) }
}
main().then(() => finish(0)).catch(error => { console.error(error); finish(1) })
function finish(code) {
  app.exit(code)
}
