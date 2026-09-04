// Opt-in real-runtime check. Stops when the official authorization page is ready.
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { ClaudeLoginService, spawnClaudeTerminal } from '../src/main/claude-login'
import { SubscriptionConnectorService } from '../src/main/subscription-connectors'

const command = process.argv[2]
if (!command) throw new Error('Provide the absolute path to an installed Claude executable.')
for (const initialized of [false, true]) {
  const directory = await mkdtemp(join(tmpdir(), 'agentflow-claude-initialization-'))
  try {
    const subscriptions = new SubscriptionConnectorService(directory)
    const options = await subscriptions.claudeLoginOptions(resolve(command))
    options.env.DISABLE_TELEMETRY = '1'
    options.env.DISABLE_ERROR_REPORTING = '1'
    if (options.mode === 'auth-command') {
      let reachedAuthorization = false
      const service = new ClaudeLoginService({ spawn: spawnClaudeTerminal, probe: async () => false })
      try {
        await service.login(options, progress => {
          if (!progress.authUrl) return
          reachedAuthorization = true
          service.cancel(progress.requestId)
        })
      } catch (error) {
        if (!reachedAuthorization) throw error
      }
      if (!reachedAuthorization) throw new Error('Expected the official Claude authorization page.')
      console.log(JSON.stringify({ fixture: 'auth-command', stoppedBeforeAuthorization: true }))
      break
    }
    if (initialized) await writeFile(join(options.env.CLAUDE_CONFIG_DIR!, '.claude.json'), JSON.stringify({ hasCompletedOnboarding: true, theme: 'dark', autoUpdates: false }))
    let reachedAccountSelection = false
    let handledTrust = false
    let handledTheme = false
    const service = new ClaudeLoginService({ spawn: spawnClaudeTerminal, probe: async () => false })
    try {
      await service.login(options, progress => {
        if (progress.message.includes('专用运行目录')) handledTrust = true
        if (progress.message.includes('默认界面设置')) handledTheme = true
        if (progress.message.includes('正在选择 Claude 订阅账户')) {
          reachedAccountSelection = true
          service.cancel(progress.requestId)
        }
      })
    } catch (error) {
      if (!reachedAccountSelection) throw error
    }
    if (!reachedAccountSelection || (initialized ? !handledTrust : !handledTheme)) throw new Error('Expected initialization stage was not handled.')
    console.log(JSON.stringify({ fixture: initialized ? 'trust-before-login' : 'fresh-profile', handledTrust, handledTheme, stoppedBeforeAuthorization: true }))
  } finally {
    if (dirname(resolve(directory)) === resolve(tmpdir()) && basename(directory).startsWith('agentflow-claude-initialization-')) await rm(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
  }
}
