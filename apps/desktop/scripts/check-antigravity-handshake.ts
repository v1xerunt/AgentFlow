// Opt-in diagnostic: no account code or model request is submitted.
import { AntigravityLoginService, spawnAntigravityTerminal } from '../src/main/antigravity-login'
import { createSubscriptionConnectorDependencies, SubscriptionConnectorService } from '../src/main/subscription-connectors'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'

const command = process.argv[2]
if (!command) throw new Error('Provide the absolute path to an installed agy executable.')
const directory = await mkdtemp(join(tmpdir(), 'agentflow-auth-handshake-'))
try {
  const subscriptions = new SubscriptionConnectorService(directory, createSubscriptionConnectorDependencies(async () => {}))
  let reachedCodeEntry = false
  const service = new AntigravityLoginService({
    spawn: spawnAntigravityTerminal,
    probe: options => subscriptions.isAntigravityAuthenticated(options.command, options.env),
    openExternal: async url => { console.log('Official auth URL host:', new URL(url).host) }
  })
  try {
    await service.login(await subscriptions.localAntigravityLoginOptions(resolve(command)), progress => {
      console.log('Login phase:', progress.phase)
      if (progress.phase === 'awaiting-code') {
        reachedCodeEntry = true
        setTimeout(() => service.cancel(progress.requestId), 0)
      }
    })
    console.log('Already authenticated; no login flow was started.')
  } catch (error) {
    if (!reachedCodeEntry) throw error
    console.log('Real runtime handshake passed; stopped before code submission.')
  }
} finally {
  if (dirname(resolve(directory)) === resolve(tmpdir()) && basename(directory).startsWith('agentflow-auth-handshake-')) {
    await rm(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
  }
}
