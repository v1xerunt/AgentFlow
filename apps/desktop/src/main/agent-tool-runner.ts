import { t } from '@agentflow/core/localization'
import { mkdir, readFile, readdir, realpath, rm, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { delimiter, extname, isAbsolute, join, relative, resolve } from 'node:path'
import type { ModelInvocationResult, ModelOutputFile } from '@agentflow/core'
import type { AgentParameters } from '@agentflow/schema'
import type { AgentToolConfiguration } from '../shared/llm'
import { runtimeEnvironment, spawnManaged, terminateProcessTree } from './platform-process'
import { resolveWorkspaceTarget } from './workspace-paths'

type AgentToolIdentity = Pick<AgentToolConfiguration, 'id' | 'name' | 'command'>

export interface AgentToolRuntimeConfiguration extends AgentToolIdentity {
  enabled: boolean
  model?: string
  reasoning?: string
  args: string[]
  resumeArgs: string[]
  env?: NodeJS.ProcessEnv
}

export interface AgentToolInvocation {
  providerId: string
  model: string
  prompt: string
  workspacePath: string
  externalSessionId?: string
  outputDirectory?: { path: string; note: string; extractText: boolean }
  parameters?: AgentParameters
}

export interface DetectedAgentTool {
  installed: boolean
  resolvedCommand?: string
  models?: string[]
  reasoningEfforts?: string[]
  modelReasoningEfforts?: Record<string, string[]>
  reasoningOverrideSupported?: boolean
}

export async function detectAgentTool(tool: AgentToolIdentity, excludedCommands: readonly string[] = []): Promise<DetectedAgentTool> {
  const excluded = new Set(await Promise.all(excludedCommands.map(async command => commandIdentity(await realpath(command).catch(() => resolve(command))))))
  const checked = new Set<string>()
  for (const candidate of await commandCandidates(tool)) {
    try {
      const command = await realpath(candidate)
      const identity = commandIdentity(command)
      if (excluded.has(identity) || checked.has(identity)) continue
      checked.add(identity)
      const result = await runProcess(command, ['--version'], homedir(), undefined, 5000)
      if (result.code === 0) return { installed: true, resolvedCommand: command, ...await detectedCapabilities(tool.id, command) }
    } catch {
      // Continue through platform-specific installation locations.
    }
  }
  return { installed: false }
}

async function detectedCapabilities(toolId: string, command: string): Promise<Omit<DetectedAgentTool, 'installed' | 'resolvedCommand'>> {
  if (toolId === 'agent-tool:codex') return readCodexCapabilities()
  if (toolId === 'agent-tool:claude-code') return readClaudeCapabilities(command)
  if (toolId === 'agent-tool:kimi-code') return readKimiCapabilities()
  return { reasoningOverrideSupported: false }
}

async function readCodexCapabilities() {
  const root = process.env.CODEX_HOME || join(homedir(), '.codex')
  try {
    const parsed = JSON.parse(await readFile(join(root, 'models_cache.json'), 'utf8')) as { models?: Array<Record<string, unknown>> }
    const modelReasoningEfforts: Record<string, string[]> = {}
    const models = (parsed.models ?? []).flatMap((item) => {
      if (typeof item.slug !== 'string' || item.visibility === 'hide') return []
      const levels = Array.isArray(item.supported_reasoning_levels)
        ? item.supported_reasoning_levels.flatMap((level) => isRecord(level) && typeof level.effort === 'string' ? [level.effort] : [])
        : []
      if (levels.length) modelReasoningEfforts[item.slug] = levels
      return [item.slug]
    })
    const configuredModel = await readTomlString(join(root, 'config.toml'), 'model')
    const defaultModel = configuredModel && modelReasoningEfforts[configuredModel] ? configuredModel : models[0]
    if (defaultModel && modelReasoningEfforts[defaultModel]) modelReasoningEfforts['@tool-default'] = modelReasoningEfforts[defaultModel]!
    return { models, reasoningEfforts: unique(Object.values(modelReasoningEfforts).flat()), modelReasoningEfforts, reasoningOverrideSupported: true }
  } catch { return { reasoningOverrideSupported: true } }
}

async function readClaudeCapabilities(command: string) {
  const help = await runProcess(command, ['--help'], homedir(), undefined, 5000).catch(() => undefined)
  let settings: Record<string, unknown> = {}
  try {
    const parsed: unknown = JSON.parse(await readFile(join(process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude'), 'settings.json'), 'utf8'))
    if (isRecord(parsed)) settings = parsed
  } catch { /* Built-in aliases remain available without a settings file. */ }
  return claudeConfigCapabilities(settings, help ? `${help.stdout}\n${help.stderr}` : '')
}

export function claudeConfigCapabilities(settings: Record<string, unknown>, help: string) {
  const reasoningOverrideSupported = /(?:^|\s)--effort(?:\s|<|\[)/m.test(help)
  const aliases = ['opus', 'sonnet', 'haiku', 'opus[1m]', 'sonnet[1m]']
  const configured = typeof settings.model === 'string' ? settings.model.trim() : undefined
  const available = Array.isArray(settings.availableModels) ? settings.availableModels.filter((model): model is string => typeof model === 'string') : undefined
  const env = isRecord(settings.env) ? settings.env : {}
  const pinned = ['ANTHROPIC_DEFAULT_OPUS_MODEL', 'ANTHROPIC_DEFAULT_SONNET_MODEL', 'ANTHROPIC_DEFAULT_HAIKU_MODEL'].flatMap(key => typeof env[key] === 'string' ? [env[key] as string] : [])
  const models = unique(available?.length ? [...available, configured ?? ''] : [...aliases, ...pinned, configured ?? ''])
  const effortLine = help.split('\n').find(line => /--effort\b/.test(line)) ?? ''
  const documentedLevels = ['low', 'medium', 'high', 'xhigh', 'max'].filter(level => new RegExp(`\\b${level}\\b`).test(effortLine))
  const modelReasoningEfforts = Object.fromEntries(models.map(model => {
    const alias = model.replace(/\[1m\]$/, '')
    const pinnedModel = env[`ANTHROPIC_DEFAULT_${alias.toUpperCase()}_MODEL`]
    const supported = reasoningOverrideSupported ? claudeReasoningEffortsForModel(typeof pinnedModel === 'string' ? pinnedModel : model) : []
    return [model, documentedLevels.length ? supported.filter(level => documentedLevels.includes(level)) : supported]
  }))
  modelReasoningEfforts['@tool-default'] = configured ? modelReasoningEfforts[configured] ?? [] : []
  return { models, reasoningEfforts: [], modelReasoningEfforts, reasoningOverrideSupported }
}

async function readKimiCapabilities() {
  const root = process.env.KIMI_CODE_HOME || join(homedir(), '.kimi-code')
  try {
    const content = await readFile(join(root, 'config.toml'), 'utf8')
    return { ...parseKimiConfigCapabilities(content), reasoningOverrideSupported: true }
  } catch { return { reasoningOverrideSupported: true } }
}

export function claudeReasoningEffortsForModel(model: string) {
  const normalized = model.trim().toLowerCase().replaceAll('_', '-')
  if (/^opus(?:\[1m\])?$/.test(normalized)) return ['low', 'medium', 'high', 'xhigh', 'max']
  if (/^sonnet(?:\[1m\])?$/.test(normalized)) return ['low', 'medium', 'high', 'max']
  if (/claude-(?:fable-(?:5(?:-1)?)|opus-(?:5|4-(?:8|7))|sonnet-5)(?:-|$)/.test(normalized)) return ['low', 'medium', 'high', 'xhigh', 'max']
  if (/claude-(?:opus|sonnet)-4-6(?:-|$)/.test(normalized)) return ['low', 'medium', 'high', 'max']
  return []
}

export function parseKimiConfigCapabilities(content: string) {
  const models: string[] = []
  const baseEfforts: Record<string, string[]> = {}
  const overrideEfforts: Record<string, string[]> = {}
  const modelProviders: Record<string, string> = {}
  const modelProtocols: Record<string, string> = {}
  const providerTypes: Record<string, string> = {}
  let section: { kind: 'model'; model: string; override: boolean } | { kind: 'provider'; provider: string } | undefined
  let defaultModel: string | undefined

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    const defaultMatch = !section ? line.match(/^default_model\s*=\s*["']([^"']+)["']/) : undefined
    if (defaultMatch) defaultModel = defaultMatch[1]
    const sectionMatch = line.match(/^\[models\.(?:"([^"]+)"|([^\].\s]+))(\.overrides)?\]$/)
    if (sectionMatch) {
      const model = sectionMatch[1] || sectionMatch[2]
      section = model ? { kind: 'model', model, override: Boolean(sectionMatch[3]) } : undefined
      if (model && !models.includes(model)) models.push(model)
      continue
    }
    const providerSectionMatch = line.match(/^\[providers\.(?:"([^"]+)"|([^\].\s]+))\]$/)
    if (providerSectionMatch) {
      const provider = providerSectionMatch[1] || providerSectionMatch[2]
      section = provider ? { kind: 'provider', provider } : undefined
      continue
    }
    if (line.startsWith('[')) { section = undefined; continue }
    if (!section) continue
    if (section.kind === 'provider') {
      const typeMatch = line.match(/^type\s*=\s*["']([^"']+)["']/)
      if (typeMatch) providerTypes[section.provider] = typeMatch[1]!
      continue
    }
    if (!section.override) {
      const providerMatch = line.match(/^provider\s*=\s*["']([^"']+)["']/)
      if (providerMatch) modelProviders[section.model] = providerMatch[1]!
      const protocolMatch = line.match(/^protocol\s*=\s*["']([^"']+)["']/)
      if (protocolMatch) modelProtocols[section.model] = protocolMatch[1]!
    }
    const effortsMatch = line.match(/^support_efforts\s*=\s*\[([^\]]*)\]/)
    if (!effortsMatch) continue
    const efforts = [...effortsMatch[1]!.matchAll(/["']([^"']+)["']/g)].map((match) => match[1]!)
    ;(section.override ? overrideEfforts : baseEfforts)[section.model] = unique(efforts)
  }

  const modelReasoningEfforts: Record<string, string[]> = Object.fromEntries(models.flatMap((model) => {
    const efforts = overrideEfforts[model] ?? baseEfforts[model]
    const provider = modelProviders[model]
    const protocol = modelProtocols[model] ?? (provider ? providerTypes[provider] : undefined)
    const supportsRuntimeOverride = protocol === 'kimi' || provider === 'kimi' || provider?.startsWith('managed:kimi')
    return efforts?.length && supportsRuntimeOverride ? [[model, efforts]] : []
  }))
  if (defaultModel && modelReasoningEfforts[defaultModel]) modelReasoningEfforts['@tool-default'] = modelReasoningEfforts[defaultModel]!
  return { models, reasoningEfforts: unique(Object.values(modelReasoningEfforts).flat()), modelReasoningEfforts }
}

async function readTomlString(path: string, key: string) {
  try {
    const content = await readFile(path, 'utf8')
    return content.match(new RegExp(`^${key}\\s*=\\s*["']([^"']+)["']`, 'm'))?.[1]
  } catch { return undefined }
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

export async function invokeAgentTool(
  tool: AgentToolRuntimeConfiguration,
  request: AgentToolInvocation,
  onDelta: (delta: string) => void,
  signal?: AbortSignal
): Promise<ModelInvocationResult> {
  signal?.throwIfAborted()
  if (!tool.enabled) throw new Error(t("{0} is disabled in settings", [tool.name]))
  if (request.outputDirectory) await prepareOutputDirectory(request.workspacePath, request.outputDirectory.path)
  const template = request.externalSessionId ? tool.resumeArgs : tool.args
  const args = renderArgs(template, request)
  signal?.throwIfAborted()
  const child = spawnManaged(tool.command, args, {
    cwd: request.workspacePath,
    env: request.providerId.endsWith('kimi-code') && tool.reasoning
      ? { ...(tool.env ?? process.env), KIMI_MODEL_THINKING_EFFORT: tool.reasoning }
      : tool.env ?? process.env
  })
  child.stdin.end(request.prompt)

  let stdout = ''
  let stderr = ''
  let content = ''
  let externalSessionId = request.externalSessionId
  let lineBuffer = ''
  let structuredError: Error | undefined

  const consumeLine = (line: string) => {
    if (structuredError) return
    const parsed = parseStructuredLine(request.providerId, line)
    if (parsed.error) {
      structuredError = new Error(t('The provider reported an error: {0}', [parsed.error]))
      terminateProcessTree(child)
      return
    }
    if (parsed.sessionId) externalSessionId = parsed.sessionId
    if (parsed.text) { content += parsed.text; onDelta(parsed.text) }
    if (parsed.finalText && !content.trim()) { content = parsed.finalText; onDelta(parsed.finalText) }
  }

  const abort = () => terminateProcessTree(child)
  signal?.addEventListener('abort', abort, { once: true })
  if (signal?.aborted) abort()

  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  child.stdout.on('data', (chunk: string) => {
    if (signal?.aborted || structuredError) return
    stdout += chunk
    if (isStructuredAgentTool(request.providerId)) {
      lineBuffer += chunk
      const lines = lineBuffer.split(/\r?\n/)
      lineBuffer = lines.pop() ?? ''
      for (const line of lines) consumeLine(line)
    } else {
      content += chunk
      onDelta(chunk)
    }
  })
  child.stderr.on('data', (chunk: string) => { stderr += chunk })

  const code = await new Promise<number>((resolve, reject) => {
    child.once('error', reject)
    child.once('close', (exitCode) => resolve(exitCode ?? 1))
  }).finally(() => signal?.removeEventListener('abort', abort))

  signal?.throwIfAborted()
  if (lineBuffer.trim()) consumeLine(lineBuffer)
  if (structuredError) throw structuredError
  if (code !== 0) throw new Error(agentToolExitErrorMessage(request.providerId, tool.name, code, stdout, stderr))
  const files = request.outputDirectory ? await collectOutputDirectory(request.workspacePath, request.outputDirectory, content) : undefined
  if (!content.trim() && !files?.length) throw new Error(t("{0} finished without returning text or output files", [tool.name]))
  return {
    content: content.trim() || t("Output files generated: {0}", [files?.length ?? 0]),
    providerId: request.providerId,
    model: tool.model || request.model,
    externalSessionId,
    files
  }
}

export async function invokeAgentToolWithRefresh(
  resolveTool: (refresh: boolean) => Promise<AgentToolRuntimeConfiguration>,
  request: AgentToolInvocation,
  onDelta: (delta: string) => void,
  signal?: AbortSignal
): Promise<ModelInvocationResult> {
  try {
    return await invokeAgentTool(await resolveTool(false), request, onDelta, signal)
  } catch (error) {
    if (!isExecutableNotFound(error)) throw error
    signal?.throwIfAborted()
    return invokeAgentTool(await resolveTool(true), request, onDelta, signal)
  }
}

export function isExecutableNotFound(error: unknown) {
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') return true
  return error instanceof Error && /\bspawn\b.*\bENOENT\b/i.test(error.message)
}

const AGENT_TOOL_LOGIN_COMMANDS: Record<string, string> = {
  'agent-tool:codex': 'codex login',
  'agent-tool:claude-code': 'claude auth login',
  'agent-tool:kimi-code': 'kimi login'
}

const AUTHENTICATION_FAILURE_PATTERNS = [
  /\b(?:not logged in|not authenticated|authentication required|login required|sign[ -]?in required|unauthori[sz]ed|http 401)\b/i,
  /\bplease (?:run|use|sign in|log in).{0,80}(?:login|log in|sign in|\/login)\b/i,
  /\b(?:oauth|access|auth(?:entication)?) token.{0,40}(?:expired|invalid|missing|not found)\b/i,
  /\b(?:missing|no valid|could not load).{0,40}(?:credential|credentials|authentication|login session)\b/i,
  /\binvalid api key.{0,80}(?:login|log in|sign in|\/login)\b/i
]

export function agentToolExitErrorMessage(providerId: string, toolName: string, code: number, stdout: string, stderr: string) {
  const detail = (stderr.trim() || stdout.trim() || t("No error details")).slice(-2_000)
  if (AUTHENTICATION_FAILURE_PATTERNS.some((pattern) => pattern.test(`${stderr}\n${stdout}`))) {
    if (providerId.startsWith('subscription:')) {
      return t("Your {0} login has expired. Reconnect in Settings → Subscription accounts and try again.", [toolName])
    }
    if (providerId === 'agent-tool:antigravity') {
      return t("Antigravity is installed but needs a valid login. Go to Settings → Local Agent tools → Antigravity, click “Sign in with Google”, and paste the authorization code.")
    }
    const loginCommand = AGENT_TOOL_LOGIN_COMMANDS[providerId]
    if (loginCommand) {
      return t("{0} is installed but needs a valid login. Run “{1}” in a terminal, sign in, then return to AgentFlow and try again.", [toolName, loginCommand])
    }
  }
  return t("{0} exited with code {1}: {2}", [toolName, code, detail])
}

async function prepareOutputDirectory(workspacePath: string, outputPath: string) {
  const root = await resolveWorkspaceTarget(workspacePath, outputPath)
  const local = outputPath.replaceAll('\\', '/').toLowerCase().split('/').filter(part => part && part !== '.')
  if (local[0] === '.agentflow' || local[0] === '.flow' && (local[1] !== 'agent-results' || local.length < 3)) throw new Error(t('Invalid project file path'))
  await rm(root, { recursive: true, force: true })
  await mkdir(root, { recursive: true })
}

async function collectOutputDirectory(workspacePath: string, output: NonNullable<AgentToolInvocation['outputDirectory']>, fallbackText: string): Promise<ModelOutputFile[]> {
  const root = await resolveWorkspaceTarget(workspacePath, output.path)
  const info = await stat(root).catch((error) => { throw new Error(t("The output directory does not exist ({0}): {1}", [output.path, error instanceof Error ? error.message : String(error)])) })
  if (!info.isDirectory()) throw new Error(t("The output path is not a directory: {0}", [output.path]))
  let paths = await listFiles(root)
  if (!paths.length && fallbackText.trim()) {
    const responsePath = join(root, 'response.md')
    await writeFile(responsePath, `${fallbackText.trim()}\n`, 'utf8')
    paths = [responsePath]
  }
  if (!paths.length) throw new Error(t("The Agent tool did not produce final text or files"))
  if (paths.length > 100) throw new Error(t("An output directory can contain up to 100 collected files"))
  return Promise.all(paths.map(async (path) => {
    const fileInfo = await stat(path)
    if (fileInfo.size > 8 * 1024 * 1024) throw new Error(t("Output file exceeds 8 MB: {0}", [relative(root, path)]))
    const bytes = await readFile(path)
    const name = relative(root, path).replaceAll('\\', '/')
    const mimeType = mimeTypeFor(path)
    if (output.extractText && isTextFile(path, mimeType)) return { name, relativePath: name, mimeType, size: fileInfo.size, mode: 'text', content: bytes.toString('utf8') }
    return {
      name,
      relativePath: name,
      mimeType,
      size: fileInfo.size,
      mode: 'attachment',
      dataBase64: bytes.toString('base64'),
      extractionError: output.extractText ? t("Text extraction is unavailable for this file format") : undefined
    }
  }))
}

async function listFiles(root: string): Promise<string[]> {
  const files: string[] = []
  const visit = async (directory: string) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) await visit(path)
      else if (entry.isFile()) files.push(path)
      else throw new Error(t('Unsupported workspace entry: {0}', [path]))
    }
  }
  await visit(root)
  return files.sort((left, right) => left.localeCompare(right))
}

const textExtensions = new Set(['.txt', '.md', '.mdx', '.csv', '.tsv', '.json', '.jsonl', '.yaml', '.yml', '.xml', '.html', '.htm', '.css', '.scss', '.less', '.js', '.jsx', '.ts', '.tsx', '.py', '.rb', '.rs', '.go', '.java', '.kt', '.swift', '.c', '.h', '.cpp', '.hpp', '.cs', '.sh', '.ps1', '.sql', '.toml', '.ini', '.log'])
function isTextFile(path: string, mimeType: string) { return mimeType.startsWith('text/') || textExtensions.has(extname(path).toLowerCase()) }
function mimeTypeFor(path: string) {
  const extension = extname(path).toLowerCase()
  return ({ '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.pdf': 'application/pdf', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.json': 'application/json', '.csv': 'text/csv', '.md': 'text/markdown', '.txt': 'text/plain', '.html': 'text/html', '.xml': 'application/xml', '.yaml': 'application/yaml', '.yml': 'application/yaml' } as Record<string, string>)[extension] ?? 'application/octet-stream'
}

function renderArgs(template: string[], request: AgentToolInvocation) {
  return template.flatMap((value) => {
    if (value === '{session}' && !request.externalSessionId) return []
    return [value
      .replaceAll('{workspace}', request.workspacePath)
      .replaceAll('{session}', request.externalSessionId ?? '')
      .replaceAll('{prompt}', request.prompt)]
  })
}

export function parseStructuredLine(providerId: string, line: string): { text: string; sessionId?: string; finalText?: string; error?: string } {
  let event: Record<string, unknown>
  try { event = JSON.parse(line) as Record<string, unknown> }
  catch { return { text: '' } }
  if (!isRecord(event)) return { text: '' }
  if (event.type === 'error' || event.type === 'turn.failed' || event.is_error === true || event.event === 'error') {
    const error = isRecord(event.error) ? event.error.message : event.error
    const message = typeof error === 'string' ? error : typeof event.message === 'string' ? event.message : typeof event.result === 'string' ? event.result : Array.isArray(event.errors) ? event.errors.join('\n') : t('No error details')
    return { text: '', error: message || t('No error details') }
  }
  if (providerId === 'agent-tool:codex' || providerId === 'subscription:codex') {
    if (event.type === 'thread.started' && typeof event.thread_id === 'string') return { text: '', sessionId: event.thread_id }
    const item = isRecord(event.item) ? event.item : undefined
    if (event.type === 'item.completed' && item?.type === 'agent_message' && typeof item.text === 'string') {
      return { text: item.text }
    }
  }
  if (providerId === 'agent-tool:claude-code' || providerId === 'subscription:claude-code') {
    if (event.type === 'system' && typeof event.session_id === 'string') return { text: '', sessionId: event.session_id }
    if (event.type === 'result' && typeof event.result === 'string') return { text: event.result }
    const message = isRecord(event.message) ? event.message : undefined
    const content = Array.isArray(message?.content) ? message.content : []
    const text = content.map((part) => isRecord(part) && part.type === 'text' && typeof part.text === 'string' ? part.text : '').join('')
    return { text }
  }
  if (providerId === 'agent-tool:kimi-code' || providerId === 'subscription:kimi-code') {
    if (event.role === 'meta' && event.type === 'session.resume_hint' && typeof event.session_id === 'string') {
      return { text: '', sessionId: event.session_id }
    }
    if (event.role !== 'assistant') return { text: '' }
    return { text: messageText(event.content) }
  }
  if (providerId === 'agent-tool:antigravity' || providerId === 'subscription:antigravity') {
    if (event.event === 'init' && typeof event.conversation_id === 'string') return { text: '', sessionId: event.conversation_id }
    const update = isRecord(event.step_update) ? event.step_update : undefined
    if (event.event === 'step_update' && typeof update?.text_delta === 'string') return { text: update.text_delta }
    const result = isRecord(event.result) ? event.result : undefined
    if (event.event === 'result') return {
      text: '',
      finalText: typeof result?.response === 'string' ? result.response : '',
      sessionId: typeof result?.conversation_id === 'string' ? result.conversation_id : undefined
    }
  }
  return { text: '' }
}

function isStructuredAgentTool(providerId: string) {
  return providerId === 'agent-tool:codex'
    || providerId === 'agent-tool:claude-code'
    || providerId === 'agent-tool:kimi-code'
    || providerId === 'agent-tool:antigravity'
    || providerId.startsWith('subscription:')
}

function runProcess(command: string, args: string[], cwd: string, stdin?: string, timeoutMs = 10000) {
  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawnManaged(command, args, { cwd })
    let stdout = ''
    let stderr = ''
    const timeout = setTimeout(() => { terminateProcessTree(child); reject(new Error(t("Command timed out"))) }, timeoutMs)
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => { stdout += chunk })
    child.stderr.on('data', (chunk: string) => { stderr += chunk })
    child.once('error', (error) => { clearTimeout(timeout); reject(error) })
    child.once('close', (code) => { clearTimeout(timeout); resolve({ code: code ?? 1, stdout, stderr }) })
    child.stdin.end(stdin)
  })
}

async function commandCandidates(tool: AgentToolIdentity) {
  if (isAbsolute(tool.command) || /[\\/]/.test(tool.command)) return [tool.command]
  const extensions = process.platform === 'win32' && !extname(tool.command) ? ['.exe', '.com', '.cmd', '.bat'] : ['']
  const directories = (runtimeEnvironment().PATH ?? '').split(delimiter).filter(Boolean).map(directory => directory.replace(/^"|"$/g, ''))
  const candidates = directories.flatMap(directory => extensions.map(extension => join(directory, `${tool.command}${extension}`)))
  const executable = process.platform === 'win32' && !extname(tool.command) ? `${tool.command}.exe` : tool.command
  const userHome = process.env.USERPROFILE || process.env.HOME

  if (process.platform === 'win32') {
    if (process.env.LOCALAPPDATA) {
      candidates.push(join(process.env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Links', executable))
      if (tool.id === 'agent-tool:codex') {
        candidates.push(...await codexDesktopCandidates(join(process.env.LOCALAPPDATA, 'OpenAI', 'Codex', 'bin')))
      }
      if (tool.id === 'agent-tool:antigravity') candidates.push(join(process.env.LOCALAPPDATA, 'agy', 'bin', 'agy.exe'))
    }
    if (process.env.APPDATA) candidates.push(join(process.env.APPDATA, 'npm', `${tool.command}.cmd`))
    if (userHome) candidates.push(join(userHome, '.local', 'bin', executable))
  } else {
    if (userHome) candidates.push(join(userHome, '.local', 'bin', executable))
    candidates.push(join('/usr/local/bin', executable), join('/opt/homebrew/bin', executable))
  }

  return [...new Set(candidates)]
}

function commandIdentity(command: string) {
  return process.platform === 'win32' ? command.toLowerCase() : command
}

function messageText(content: unknown) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content.map((part) => isRecord(part) && part.type === 'text' && typeof part.text === 'string' ? part.text : '').join('')
}

async function codexDesktopCandidates(root: string) {
  try {
    const entries = await readdir(root, { withFileTypes: true })
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(root, entry.name, 'codex.exe'))
      .reverse()
  } catch {
    return []
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
