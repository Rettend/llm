import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  dts: true,
  // dts: {
  //   tsgo: true,
  // },
  external: ['@elysiajs/eden'],
  noExternal: ['@rttnd/llm-shared'],
})
