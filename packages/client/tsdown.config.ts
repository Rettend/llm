import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  dts: {
    tsgo: true,
  },
  noExternal: ['@rttnd/llm-shared'],
})
