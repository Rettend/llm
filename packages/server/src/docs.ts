export const apiDescription = `A lightweight, cache-optimized LLM registry that auto-updates from Artificial Analysis API daily and runs on Cloudflare Workers.

## TypeScript

We recommend using the type-safe TypeScript client instead of making raw REST calls:

\`\`\`bash
bun add @rttnd/llm
\`\`\`

\`\`\`typescript
import { createRegistry } from '@rttnd/llm'

const registry = createRegistry({
  baseUrl: 'https://llm.yoursubdomain.workers.dev',
})

// Get all models
const { data: models } = await registry.getModels()

// Search with filters
const { data: visionModels } = await registry.searchModels({
  capability: 'vision',
  minIq: 3,
})
\`\`\`

See the full client documentation at [github.com/Rettend/llm](https://github.com/Rettend/llm)`

export const manifestDescription = `Returns the complete registry with all providers and models.

**TypeScript:**
\`\`\`typescript
const { data: manifest } = await registry.getManifest()
console.log(manifest.version, manifest.providers, manifest.models)
\`\`\``

export const providersDescription = `Returns a list of all LLM providers with their metadata including name, API key format, and documentation links.

**TypeScript Client:**
\`\`\`typescript
const { data: providers } = await registry.getProviders()
providers.forEach(p => console.log(p.name, p.website))
\`\`\``

export const searchModelsDescription = `Search and filter models by name, provider, capabilities, IQ score (0-5), and speed score (0-5). All parameters are optional and can be combined.

**TypeScript Client:**
\`\`\`typescript
// Search by name
const { data } = await registry.searchModels({ name: 'gpt' })

// Filter by capabilities and scores
const { data: visionModels } = await registry.searchModels({
  capability: 'vision',
  minIq: 3,
  minSpeed: 2,
})

// Combine multiple filters
const { data: models } = await registry.searchModels({
  provider: 'anthropic',
  capability: 'toolUse',
  minIq: 4,
})
\`\`\``

export const providerModelsDescription = `Returns all models for a specific provider.

**TypeScript Client:**
\`\`\`typescript
const { data: openaiModels } = await registry.getProviderModels('openai')
const { data: anthropicModels } = await registry.getProviderModels('anthropic')
\`\`\``

export const versionDescription = `Returns version metadata for the registry including version identifier, ETag, and generation timestamp. Useful for checking if data has been updated.

**TypeScript Client:**
\`\`\`typescript
const { data: version } = await registry.getVersion()
console.log('Registry version:', version.version)
console.log('Last updated:', version.generatedAt)
\`\`\``

export const healthDescription = `Returns the health status of the API.

**TypeScript Client:**
\`\`\`typescript
const { data: health } = await registry.getHealth()
console.log(health.status) // 'ok'
\`\`\``

export const cronTriggerDescription = `Manually trigger the cron job to refresh the manifest from Artificial Analysis API.

**Authentication:**
Requires a valid auth token via:
- \`Authorization: Bearer <token>\` header
- \`?token=<token>\` query parameter

Set the \`CRON_AUTH_TOKEN\` environment variable in Cloudflare dashboard.`
