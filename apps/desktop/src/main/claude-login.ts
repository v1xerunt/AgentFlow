import { t } from '@agentflow/core/localization'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { stripVTControlCharacters } from 'node:util'
import type { RuntimeLoginProgress } from '../shared/llm'
import type { LoginTerminal } from './antigravity-login'
import { terminalCommand } from './platform-process'

export interface ClaudeLoginOptions {
  command: string
  cwd: string
  env: NodeJS.ProcessEnv
  mode?: 'auth-command' | 'interactive'
}
export interface ClaudeAccount { connected: boolean; accountLabel?: string; planType?: string }
export interface ClaudeLoginDependencies {
  spawn(options: ClaudeLoginOptions): Promise<LoginTerminal>
  probe(options: ClaudeLoginOptions): Promise<boolean>
}

// Read only the connector's isolated profile, never the user's default profile.
export async function readClaudeSubscriptionAccount(profile: string, now = Date.now()): Promise<ClaudeAccount> {
  try {
    const credentials = JSON.parse(await readFile(join(profile, '.credentials.json'), 'utf8'))
    const oauth = credentials?.claudeAiOauth
    if (typeof oauth?.accessToken !== 'string' || !oauth.accessToken
      || typeof oauth.expiresAt !== 'number' || oauth.expiresAt <= now
      || !Array.isArray(oauth.scopes) || !oauth.scopes.includes('user:inference')) return { connected: false }
    let config: { oauthAccount?: { emailAddress?: string } } = {}
    try { config = JSON.parse(await readFile(join(profile, '.claude.json'), 'utf8')) } catch { /* The account label is optional. */ }
    return { connected: true, accountLabel: config.oauthAccount?.emailAddress, planType: typeof oauth.subscriptionType === 'string' ? oauth.subscriptionType : undefined }
  } catch { return { connected: false } }
}

export function claudeAuthUrl(raw: string) {
  const hyperlinks = [...raw.matchAll(/\x1b\]8;[^;]*;([^\x07\x1b]+)(?:\x07|\x1b\\)/g)]
    .flatMap(match => match[1] ? [match[1]] : [])
  const text = stripVTControlCharacters(raw)
  // Require a terminator so a URL split across terminal chunks isn't opened early.
  const visibleUrls = text.match(/https:\/\/(?:(?!https:\/\/)[^\s<>"'])+(?=\s|https:\/\/)/g) ?? []
  const candidates = [...hyperlinks, ...visibleUrls]
  return candidates.find(value => {
    try {
      const url = new URL(value)
      const officialAuthorizationPath = (
        ['https://claude.ai', 'https://console.anthropic.com', 'https://platform.claude.com'].includes(url.origin)
          && /\/oauth\/authorize\/?$/.test(url.pathname)
      ) || (url.origin === 'https://claude.com' && /\/cai\/oauth\/authorize\/?$/.test(url.pathname))
      return officialAuthorizationPath && !url.username && !url.password
        && ['client_id', 'state', 'code_challenge'].every(key => Boolean(url.searchParams.get(key)))
    } catch { return false }
  })
}

export function claudeLoginFailure(raw: string) {
  const text = stripVTControlCharacters(raw)
  if (/Unable to connect to Anthropic services|Failed to connect to (?:api\.)?anthropic\.com|\b(?:ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT)\b/i.test(text)) {
    return t("Claude could not reach Anthropic services. Check your network, proxy, DNS, and supported region, then reconnect.")
  }
  if (/Failed to start OAuth callback server|Is port \d+ in use\?/i.test(text)) {
    return t("Claude could not start its local login callback. Close other Claude login attempts and reconnect.")
  }
  return undefined
}

export class ClaudeLoginService {
  private active?: { id: string; submit(value: string): void; cancel(): void }

  constructor(private readonly dependencies: ClaudeLoginDependencies) {}

  submit(requestId: string, value: string) {
    if (!this.active || this.active.id !== requestId) throw new Error(t("This Claude login has ended. Reconnect to continue."))
    if (typeof value !== 'string' || value.length > 4096 || !/^[A-Za-z0-9_./~+\-=#]+$/.test(value.trim())) throw new Error(t("Paste only the authorization code shown on the Claude page."))
    this.active.submit(value.trim())
  }

  cancel(requestId?: string) {
    if (this.active && (!requestId || this.active.id === requestId)) this.active.cancel()
  }

  async login(options: ClaudeLoginOptions, report: (progress: RuntimeLoginProgress) => void): Promise<void> {
    if (this.active) throw new Error(t("A Claude login is already in progress. Complete or cancel it first."))
    const id = randomUUID()
    return new Promise<void>((resolveLogin, reject) => {
      let terminal: LoginTerminal | undefined
      let settled = false
      let buffer = ''
      let authUrl: string | undefined
      let awaitingCode = false
      let submitted = false
      let mainReady = false
      let polling = false
      let loginRequested = false
      const directAuth = options.mode === 'auth-command'
      let scheduled = false
      let lastPhase: RuntimeLoginProgress['phase'] = 'starting'
      const handled = new Set<string>()
      const listeners: Array<{ dispose(): void }> = []
      const timers = new Set<ReturnType<typeof setTimeout>>()
      let stepTimeout: ReturnType<typeof setTimeout> | undefined
      let parseTimeout: ReturnType<typeof setTimeout> | undefined
      let sessionTimeout: ReturnType<typeof setTimeout> | undefined
      let authorizationWindowStarted = false
      const publish = (phase: RuntimeLoginProgress['phase'], message: string) => {
        lastPhase = phase
        report({ requestId: id, provider: 'claude', phase, message, authUrl })
      }
      const finish = (phase: 'connected' | 'cancelled' | 'error', message: string) => {
        if (settled) return
        settled = true
        clearTimeout(sessionTimeout)
        clearTimeout(stepTimeout)
        clearTimeout(parseTimeout)
        clearInterval(pollTimer)
        timers.forEach(timer => clearTimeout(timer))
        listeners.forEach(listener => listener.dispose())
        try { terminal?.kill() } catch { /* The child may already have exited. */ }
        if (this.active?.id === id) this.active = undefined
        buffer = ''
        authUrl = undefined
        publish(phase, message)
        if (phase === 'connected') resolveLogin()
        else reject(new Error(message))
      }
      const armStepTimeout = () => {
        clearTimeout(stepTimeout)
        stepTimeout = setTimeout(() => finish('error', t("Claude initialization could not continue. A new confirmation may be required. Update the runtime and try again.")), 60_000)
      }
      const armSessionTimeout = (duration: number) => {
        clearTimeout(sessionTimeout)
        sessionTimeout = setTimeout(() => finish('error', t("Claude login timed out. Reconnect to continue.")), duration)
      }
      const later = (action: () => void, delay = 150) => {
        const timer = setTimeout(() => {
          timers.delete(timer)
          if (settled) return
          try { action() } catch { finish('error', t("The Claude login input channel has closed. Reconnect to continue.")) }
        }, delay)
        timers.add(timer)
      }
      const enter = (key: string, message: string, prefix?: string) => {
        if (handled.has(key) || !terminal || scheduled) return
        handled.add(key)
        buffer = ''
        scheduled = true
        publish('starting', message)
        if (settled) return
        armStepTimeout()
        if (prefix) terminal.write(prefix)
        later(() => { terminal?.write('\r'); scheduled = false })
      }
      const verify = async () => {
        if (settled || polling || (!directAuth && !mainReady)) return
        polling = true
        try {
          const connected = await this.dependencies.probe(options)
          if (settled) return
          if (connected) finish('connected', directAuth ? t("Claude account connected.") : t("Claude account connected and initialization complete."))
          else if (directAuth) return
          else if (!loginRequested && !handled.has('success') && !submitted) {
            loginRequested = true
            mainReady = false
            buffer = ''
            publish('starting', t("Opening Claude subscription login…"))
            if (settled) return
            armStepTimeout()
            terminal?.write('/login')
            later(() => terminal?.write('\r'))
          }
        } catch { /* A bounded retry allows the runtime to finish writing its credentials. */ }
        finally { polling = false }
      }
      const parse = () => {
        if (settled || scheduled) return
        const text = stripVTControlCharacters(buffer)
        const failure = claudeLoginFailure(buffer)
        if (failure) { finish('error', failure); return }
        if (submitted && /invalid_grant|invalid (?:authorization )?code|(?:authentication|token exchange) failed/i.test(text)) {
          finish('error', t("The Claude authorization code is invalid or expired. Reconnect to get a new code.")); return
        }
        // Evaluate directory trust in every phase, including before any login menu.
        if (!handled.has('trust') && text.includes('Do you trust the files in this folder?') && /(?:>|❯)\s*1\.\s*Yes, proceed/.test(text) && /Enter to confirm/.test(text)) {
          enter('trust', t("Preparing the AgentFlow runtime directory…")); return
        }
        if (!handled.has('theme') && /Choose the text style|Choose (?:a |your )?theme/i.test(text) && /(?:>|❯)\s*\d+\.\s*(?:Dark|Light) mode/.test(text)) {
          enter('theme', t("Applying default interface settings…")); return
        }
        if (!handled.has('method') && /Select login method:/.test(text)) {
          const selected = text.match(/(?:>|❯)\s*(\d+)\.\s*[^\r\n]+/)
          const subscription = text.match(/(\d+)\.\s*Claude account with subscription/)
          if (selected && subscription) {
            const difference = Number(subscription[1]) - Number(selected[1])
            if (Math.abs(difference) > 5) { finish('error', t("Claude login options have changed. Update the runtime and try again.")); return }
            enter('method', t("Selecting the Claude subscription account…"), (difference < 0 ? '\x1b[A' : '\x1b[B').repeat(Math.abs(difference)))
          }
          return
        }
        if (!handled.has('success') && /Login successful[\s\S]*Press Enter to continue/i.test(text)) {
          awaitingCode = false
          enter('success', t("Signed in. Completing initialization…")); return
        }
        if (!handled.has('security') && /Security notes:[\s\S]*Claude can make mistakes[\s\S]*Press Enter to continue/i.test(text)) {
          enter('security', t("Completing Claude safety information and initialization…")); return
        }
        const foundUrl = claudeAuthUrl(buffer)
        if (foundUrl) {
          authUrl = foundUrl
          if (!authorizationWindowStarted) {
            authorizationWindowStarted = true
            armSessionTimeout(3 * 60_000)
          }
          if (directAuth && !awaitingCode && !submitted) {
            clearTimeout(stepTimeout)
            publish('starting', t("Complete Claude subscription login in your browser. Email or organization verification can remain open for up to three minutes."))
          }
        }
        if (!submitted && /Paste (?:code|.*authorization code) here|Paste.*code.*(?:below|prompted)/i.test(text) && authUrl) {
          if (!awaitingCode) {
            awaitingCode = true
            clearTimeout(stepTimeout)
            publish('awaiting-code', t("Authorize Claude in your browser. If the page shows an authorization code, paste it below."))
          }
          return
        }
        if (/\? for shortcuts/.test(text) && /Claude Code v[\d.]+/.test(text)) {
          mainReady = true
          awaitingCode = false
          if (lastPhase !== 'verifying') publish('verifying', t("Checking Claude subscription and initialization…"))
          void verify()
        }
      }
      armSessionTimeout(10 * 60_000)
      const pollTimer = setInterval(() => { if (!directAuth) void verify() }, 2_000)
      this.active = {
        id,
        cancel: () => finish('cancelled', t("Claude login cancelled.")),
        submit: value => {
          if (!awaitingCode || submitted || !terminal) throw new Error(t("Wait for the Claude login page to be ready before submitting the code."))
          submitted = true
          awaitingCode = false
          buffer = ''
          publish('verifying', t("Verifying Claude authorization code…"))
          if (settled) return
          armStepTimeout()
          // The dedicated auth command reads a plain line from stdin. Older
          // interactive Ink sessions need bracketed paste to preserve the code.
          terminal.write(directAuth ? value : `\x1b[200~${value}\x1b[201~`)
          later(() => terminal?.write('\r'))
        }
      }
      publish('starting', directAuth ? t("Preparing Claude subscription login…") : t("Preparing Claude login and initialization…"))
      if (settled) return
      armStepTimeout()
      void this.dependencies.spawn(options).then(spawned => {
        if (settled) { spawned.kill(); return }
        terminal = spawned
        listeners.push(terminal.onData(chunk => {
          if (settled) return
          if (chunk.includes('\x1b[6n')) terminal?.write('\x1b[1;1R')
          buffer = `${buffer}${chunk}`.slice(-64_000)
          clearTimeout(parseTimeout)
          parseTimeout = setTimeout(parse, 40)
        }))
        listeners.push(terminal.onExit(({ exitCode }) => {
          if (settled) return
          const failure = claudeLoginFailure(buffer)
          if (failure) { finish('error', failure); return }
          if (directAuth && exitCode === 0) {
            publish('verifying', t("Checking Claude subscription…"))
            void verify().then(() => {
              if (!settled) finish('error', t("Claude login finished without a valid subscription account. Reconnect to continue."))
            })
            return
          }
          finish('error', directAuth
            ? t("The Claude login process exited before authentication completed. Reconnect to continue.")
            : t("The Claude initialization process has exited. Reconnect to continue."))
        }))
      }).catch(() => finish('error', t("Could not start Claude login. Check the runtime and shell configuration, then try again.")))
    })
  }
}

export async function spawnClaudeTerminal(options: ClaudeLoginOptions): Promise<LoginTerminal> {
  const pty = await import('node-pty')
  const args = options.mode === 'auth-command' ? ['auth', 'login', '--claudeai'] : []
  const launch = terminalCommand(options.command, options.env, args)
  const env = Object.fromEntries(Object.entries(launch.env).filter((entry): entry is [string, string] => entry[1] !== undefined))
  // Current runtimes have a stable authentication command. Older versions fall
  // back to one interactive session that completes login and onboarding.
  return pty.spawn(launch.command, launch.args, { cwd: options.cwd, env, name: 'xterm-256color', cols: 2000, rows: 40 })
}
