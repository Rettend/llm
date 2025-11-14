import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/types.ts',
    'src/registry.ts',
    'src/search.ts',
  ],
  dts: {
    tsgo: true,
  },
})
