import { t } from '@agentflow/core/localization'
import { terminalCommand } from './platform-process'
import { randomUUID } from 'node:crypto'
import { stripVTControlCharacters } from 'node:util'
import type { RuntimeLoginProgress } from '../shared/llm'

interface Disposable { dispose(): void }
export interface LoginTerminal {
  write(data: string): void
  kill(): void
  onData(listener: (data: string) => void): Disposable
  onExit(listener: (event: { exitCode: number }) => void): Disposable
}
export interface AntigravityLoginOptions { command: string; cwd: string; env: NodeJS.ProcessEnv }
export interface AntigravityLoginDependencies {
  spawn(options: AntigravityLoginOptions): Promise<LoginTerminal>
  probe(options: AntigravityLoginOptions): Promise<boolean>
  openExternal(url: string): Promise<void>
}

export class AntigravityLoginService {
  private active?: { id: string; submit(code: string): void; cancel(): void }

  constructor(private readonly dependencies: AntigravityLoginDependencies) {}

  submit(requestId: string, value: string) {
    if (!this.active || this.active.id !== requestId) throw new Error(t("This login has ended. Click Sign in with Google again."))
    if (typeof value !== 'string' || value.length > 4096 || !/^[A-Za-z0-9_./~+\-=]+$/.test(value.trim())) {
      throw new Error(t("Paste only the authorization code shown on the Google page."))
    }
    this.active.submit(value.trim())
  }

  cancel(requestId?: string) {
    if (this.active && (!requestId || this.active.id === requestId)) this.active.cancel()
  }

  async login(options: AntigravityLoginOptions, report: (progress: RuntimeLoginProgress) => void) {
    if (this.active) throw new Error(t("A Google login is already in progress. Complete or cancel it first."))
    const id = randomUUID()
    // SSH mode is the official manual-code flow; a PTY supplies the TUI's input channel.
    const environment = { ...options.env, SSH_CONNECTION: '127.0.0.1 0 127.0.0.1 0', AGY_CLI_DISABLE_AUTO_UPDATE: 'true' }
    const runtime = { ...options, env: environment }
    return new Promise<void>((resolve, reject) => {
      let terminal: LoginTerminal | undefined
      let settled = false
      let selectedGoogle = false
      let awaitingCode = false
      let submitted = false
      let polling = false
      let buffer = ''
      let authUrl: string | undefined
      const listeners: Disposable[] = []
      let verificationTimer: ReturnType<typeof setTimeout> | undefined
      const publish = (phase: RuntimeLoginProgress['phase'], message: string) => report({ requestId: id, phase, message, authUrl })
      const finish = (phase: 'connected' | 'error' | 'cancelled', message: string) => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        clearTimeout(startupTimeout)
        clearTimeout(verificationTimer)
        clearInterval(pollTimer)
        listeners.forEach(listener => listener.dispose())
        try { terminal?.kill() } catch { /* The process may already have exited. */ }
        if (this.active?.id === id) this.active = undefined
        buffer = ''
        authUrl = undefined
        publish(phase, message)
        if (phase === 'connected') resolve()
        else reject(new Error(message))
      }
      const verify = async () => {
        if (settled || polling || !submitted) return
        polling = true
        try {
          if (await this.dependencies.probe(runtime)) finish('connected', t("Google account connected. You can return to your Agent."))
        } catch { /* Retry until the bounded verification deadline. */ }
        finally { polling = false }
      }
      const timeout = setTimeout(() => finish('error', t("Google login timed out. Sign in again using the code from the new page.")), 10 * 60_000)
      const startupTimeout = setTimeout(() => finish('error', t("Antigravity could not start login. Check your connection and try again.")), 45_000)
      const pollTimer = setInterval(() => void verify(), 2_000)
      this.active = {
        id,
        cancel: () => finish('cancelled', t("Google login cancelled.")),
        submit: code => {
          if (!awaitingCode || submitted || !terminal) throw new Error(t("Wait for the login page to be ready before submitting the code."))
          submitted = true
          awaitingCode = false
          buffer = ''
          publish('verifying', t("Verifying authorization code…"))
          verificationTimer = setTimeout(() => finish('error', t("Authorization is incomplete. Check your connection and sign in again.")), 60_000)
          try { terminal.write(`${code}\r`) }
          catch { finish('error', t("Could not pass the code to Antigravity. Sign in again.")) }
        }
      }
      publish('starting', t("Preparing Google login…"))
      void (async () => {
        if (settled) return
        if (await this.dependencies.probe(runtime)) { finish('connected', t("Google account connected. You can return to your Agent.")); return }
        if (settled) return
        const spawned = await this.dependencies.spawn(runtime)
        if (settled) { spawned.kill(); return }
        terminal = spawned
        listeners.push(terminal.onData(chunk => {
          if (settled) return
          if (chunk.includes('\x1b[6n')) terminal?.write('\x1b[1;1R')
          buffer = `${buffer}${chunk}`.slice(-64_000)
          const text = stripVTControlCharacters(buffer)
          if (!selectedGoogle && /Select login method:[\s\S]*>\s*1\. Google OAuth/.test(text)) {
            selectedGoogle = true
            terminal?.write('\r')
          }
          if (submitted) {
            if (/failed to exchange authorization code|invalid_grant|authorization code (?:is )?(?:invalid|expired)|authentication failed/i.test(text)) {
              finish('error', t("The Google authorization code is invalid or expired. Sign in again to get a new code."))
            }
            return
          }
          if (awaitingCode || !/authorization code|code displayed in the browser/i.test(text)) return
          const urls = text.match(/https:\/\/[^\s<>"'\x1b]+/g) ?? []
          authUrl = urls.find(value => {
            try {
              const url = new URL(value)
              return url.origin === 'https://accounts.google.com' && !url.username && !url.password
                && url.searchParams.has('client_id') && url.searchParams.has('redirect_uri') && url.searchParams.has('state')
            } catch { return false }
          })
          if (!authUrl) return
          awaitingCode = true
          clearTimeout(startupTimeout)
          publish('awaiting-code', t("Sign in on the Google page, then paste its authorization code below."))
          void this.dependencies.openExternal(authUrl).catch(() => {
            if (!settled && !submitted) publish('awaiting-code', t("The browser did not open. Click “Open Google login page”, sign in, and paste the code."))
          })
        }))
        listeners.push(terminal.onExit(() => {
          if (settled) return
          void this.dependencies.probe(runtime).then(connected => {
            if (connected) finish('connected', t("Google account connected. You can return to your Agent."))
            else finish('error', t("The Antigravity login process has exited. Sign in again."))
          }).catch(() => finish('error', t("Could not verify Google login. Check your connection and sign in again.")))
        }))
      })().catch(() => finish('error', t("Could not start Antigravity login. Check the runtime and your connection, then try again.")))
    })
  }
}

export async function spawnAntigravityTerminal(options: AntigravityLoginOptions): Promise<LoginTerminal> {
  const pty = await import('node-pty')
  const launch = terminalCommand(options.command, options.env)
  const env = Object.fromEntries(Object.entries(launch.env).filter((entry): entry is [string, string] => entry[1] !== undefined))
  return pty.spawn(launch.command, launch.args, { cwd: options.cwd, env, name: 'xterm-256color', cols: 2000, rows: 40 })
}
