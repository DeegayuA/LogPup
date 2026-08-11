import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Mirrors tsconfig.json's `@/*` -> `./src/*` path alias (Next.js resolves
  // it automatically; Vitest doesn't, so any tested module that imports a
  // shared `@/...` module needs this or it fails to resolve at test time.
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { include: ['src/**/*.test.ts'] },
})
