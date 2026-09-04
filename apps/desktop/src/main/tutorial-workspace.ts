import { t } from '@agentflow/core/localization'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { TUTORIAL_BRIEF, TUTORIAL_CSV } from '../shared/tutorial-content'

export async function ensureTutorialWorkspace(storeDirectory: string) {
  const root = join(storeDirectory, 'examples', 'customer-weekly-brief')
  await mkdir(root, { recursive: true })
  for (const [name, content] of [["weekly-requirements.md", TUTORIAL_BRIEF()], ["customer-feedback.csv", TUTORIAL_CSV()]]) {
    await writeFile(join(root, name!), content!, { encoding: 'utf8', flag: 'wx' }).catch((error: NodeJS.ErrnoException) => { if (error.code !== 'EEXIST') throw error })
  }
  return root
}
