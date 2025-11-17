import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  dts: {
    tsgo: true,
    resolve: ['@rttnd/llm-shared'], // TODO: doesn't work, it can't inline types, only js is inlined
  },
  noExternal: ['@rttnd/llm-shared'],
})
