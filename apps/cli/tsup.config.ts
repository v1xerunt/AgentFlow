import { defineConfig } from 'tsup'
import { copyFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  entry: ['src/index.ts'], format: ['esm'], dts: true, clean: true,
  noExternal: [/.*/],
  banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" },
  onSuccess: async () => {
    createRequire(import.meta.url)('../../scripts/collect-licenses.cjs')(
      fileURLToPath(new URL('.', import.meta.url)),
      fileURLToPath(new URL('./dist/licenses', import.meta.url))
    )
    for (const name of ['LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES.md']) {
      await copyFile(new URL(`../../${name}`, import.meta.url), new URL(`./dist/${name}`, import.meta.url))
    }
  }
})
