import { randomUUID } from 'node:crypto'
import { mkdir, open, rename, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { setTimeout } from 'node:timers/promises'

const writes = new Map<string, Promise<void>>()

export async function atomicWriteFile(target: string, content: string | Buffer) {
  const absolute = resolve(target)
  const key = process.platform === 'win32' ? absolute.toLowerCase() : absolute
  const pending = (writes.get(key) ?? Promise.resolve()).catch(() => {}).then(() => replaceFile(absolute, content))
  writes.set(key, pending)
  try { await pending } finally { if (writes.get(key) === pending) writes.delete(key) }
}

async function replaceFile(target: string, content: string | Buffer) {
  await mkdir(dirname(target), { recursive: true })
  const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`
  try {
    const file = await open(temporary, 'wx', 0o600)
    try { await file.writeFile(content); await file.sync() } finally { await file.close() }
    for (let attempt = 0; ; attempt++) {
      try { await rename(temporary, target); break }
      catch (error) {
        if (process.platform !== 'win32' || !['EPERM', 'EACCES', 'EBUSY'].includes((error as NodeJS.ErrnoException).code ?? '') || attempt >= 5) throw error
        // Antivirus/indexers can briefly hold the destination open on Windows.
        await setTimeout(30 * (attempt + 1))
      }
    }
  } finally { await rm(temporary, { force: true }).catch(() => {}) }
}
