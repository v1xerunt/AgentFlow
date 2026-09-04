import { t } from '@agentflow/core/localization'
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
import type { InputItemDefinition } from '@agentflow/schema'
import { createId } from './workspace-store'

export type InputFileKind = 'text' | 'image' | 'unsupported'

const plainTextExtensions = new Set([
  'txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'jsonl', 'yaml', 'yml', 'xml',
  'html', 'htm', 'css', 'js', 'jsx', 'ts', 'tsx', 'py', 'rb', 'go', 'rs', 'java',
  'c', 'cpp', 'h', 'hpp', 'sql', 'log', 'ini', 'toml', 'tex'
])

const imageMimeByExtension: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', heic: 'image/heic', heif: 'image/heif'
}

export const INPUT_FILE_ACCEPT = [...plainTextExtensions, 'pdf', 'docx', ...Object.keys(imageMimeByExtension)].map((extension) => `.${extension}`).join(',')

export function classifyInputFile(file: Pick<File, 'name' | 'type'>): InputFileKind {
  if (canExtractAsText(file)) return 'text'
  const extension = fileExtension(file.name)
  const mime = file.type.toLowerCase()
  return (mime.startsWith('image/') && Object.values(imageMimeByExtension).includes(mime)) || extension in imageMimeByExtension ? 'image' : 'unsupported'
}

export function canExtractAsText(file: Pick<File, 'name' | 'type'>) {
  const extension = fileExtension(file.name)
  return plainTextExtensions.has(extension) || extension === 'pdf' || extension === 'docx' || file.type.startsWith('text/')
}

export async function importInputFile(file: File): Promise<InputItemDefinition> {
  const kind = classifyInputFile(file)
  if (kind === 'unsupported') throw new Error(t("{0} is not a supported text or image format.", [file.name]))
  if (kind === 'image') {
    return {
      id: createId('input-item'),
      name: file.name,
      kind: 'file',
      mode: 'attachment',
      mimeType: imageMimeByExtension[fileExtension(file.name)] ?? file.type.toLowerCase(),
      size: file.size,
      content: '',
      dataBase64: arrayBufferToBase64(await file.arrayBuffer())
    }
  }
  return {
    id: createId('input-item'),
    name: file.name,
    kind: 'file',
    mode: 'text',
    mimeType: file.type || mimeFromExtension(fileExtension(file.name)),
    size: file.size,
    content: await extractFileText(file)
  }
}

export async function extractFileText(file: File): Promise<string> {
  const extension = fileExtension(file.name)
  if (extension === 'pdf' || file.type === 'application/pdf') return extractPdf(await file.arrayBuffer())
  if (extension === 'docx' || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const mammoth = await import('mammoth/mammoth.browser')
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
    return result.value.trim()
  }
  if (plainTextExtensions.has(extension) || file.type.startsWith('text/')) {
    const text = await file.text()
    return extension === 'html' || extension === 'htm' ? htmlToText(text) : text
  }
  throw new Error(t("Text extraction is unavailable for {0}. Convert it to PDF, DOCX, or plain text first.", [file.name]))
}

async function extractPdf(buffer: ArrayBuffer) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) })
  try {
    const document = await loadingTask.promise
    const pages: string[] = []
    for (let index = 1; index <= document.numPages; index += 1) {
      const page = await document.getPage(index)
      const text = await page.getTextContent()
      pages.push(text.items.map((item) => 'str' in item ? item.str : '').filter(Boolean).join(' '))
    }
    return pages.map((page, index) => `--- ${t('Page {0}', [index + 1])} ---\n${page}`).join('\n\n').trim()
  } finally { await loadingTask.destroy() }
}

function htmlToText(source: string) {
  return source
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function fileExtension(name: string) {
  return name.toLowerCase().split('.').pop() ?? ''
}

function mimeFromExtension(extension: string) {
  if (imageMimeByExtension[extension]) return imageMimeByExtension[extension]
  if (extension === 'pdf') return 'application/pdf'
  if (extension === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (extension === 'html' || extension === 'htm') return 'text/html'
  if (extension === 'csv') return 'text/csv'
  if (extension === 'md' || extension === 'markdown') return 'text/markdown'
  return 'text/plain'
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  }
  return btoa(binary)
}
