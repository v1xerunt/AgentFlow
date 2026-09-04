import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { agentLibrarySchema, emptyAgentLibrary, type AgentLibrary } from '../shared/agent-library'
import { atomicWriteFile } from './atomic-file'

export class AgentLibraryStore {
  private writes = Promise.resolve()
  constructor(private directory: string) {}
  async load(): Promise<AgentLibrary> {
    await this.writes
    try { return agentLibrarySchema.parse(JSON.parse(await readFile(join(this.directory, 'agent-library.json'), 'utf8'))) }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyAgentLibrary(); throw error }
  }
  save(value: unknown): Promise<void> {
    const serialized = JSON.stringify(agentLibrarySchema.parse(value), null, 2)
    const write = this.writes.then(async () => {
      const path = join(this.directory, 'agent-library.json')
      await atomicWriteFile(path, serialized)
    })
    this.writes = write.catch(() => undefined)
    return write
  }
}
