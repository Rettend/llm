import { defineConfig } from 'bumpp'

export default defineConfig({
  files: [
    'package.json',
    'packages/client/package.json',
    'packages/shared/package.json',
    'packages/server/package.json',
  ],
  all: true,
  execute: 'bun run scripts/bump.ts',
})
