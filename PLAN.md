# LLM Registry

## Overview

A lightweight, cache-optimized LLM registry system that:

- **Auto-updates** from Artificial Analysis API daily
- **Serves** via Cloudflare Workers (Elysia + Eden)
- **Caches** aggressively at every layer
- **Publishes** a human-readable snapshot to GitHub for transparency
- **Provides** TypeScript client library (uses Eden internally)

## Core Philosophy

1. **Single source of truth**: Artificial Analysis API
2. **Maximum caching**: CDN, KV, client-side, and GitHub fallback
3. **Zero maintenance**: Apps auto-update without redeployment
4. **Type-safe**: Full TypeScript support with Eden for internal calls

---

## Data flow (daily)

1) Cloudflare Cron fetches AA models → transform → score → build minimal manifest
2) Store manifest JSON in Workers KV at key `manifest`
3) A GitHub Action (on schedule) fetches the manifest and publishes a compact, human-readable snapshot to GitHub (no raw AA data)
4) API serves from KV with Cache-Control and ETag
5) Client caches in memory (default) and auto-refreshes using `/version`

---

## Backend

### Data Schema

```typescript
export interface Provider {
  value: string // 'openai', 'anthropic', etc.
  name: string // 'OpenAI', 'Anthropic'
  keyPlaceholder?: string // 'sk-...', 'sk-ant-...'
  website?: string // to get the api key
  status?: 'active' | 'beta' | 'deprecated'
}

export interface Model {
  // Identity
  id: string // Original AA id
  value: string // Model string for AI SDK
  provider: string
  name: string // Display name
  alias?: string // Short name for dropdowns

  // Capabilities
  capabilities?: {
    text?: boolean
    vision?: boolean
    reasoning?: boolean
    toolUse?: boolean
    json?: boolean
    streaming?: boolean
    audio?: boolean
  }

  // Performance
  iq?: 0 | 1 | 2 | 3 | 4 | 5 // Derived from AA intelligence index
  speed?: 0 | 1 | 2 | 3 | 4 | 5 // Derived from AA output tokens/sec

  // Metrics (raw data from AA)
  metrics?: {
    contextWindow?: number
    maxOutputTokens?: number
    medianOutputTokensPerSecond?: number
    medianTimeToFirstToken?: number
    intelligenceIndex?: number
    codingIndex?: number
    mathIndex?: number
  }

  // Pricing (per 1M tokens)
  pricing?: {
    input?: number
    output?: number
    blended?: number // 3:1 ratio default
  }

  // Metadata
  releaseDate?: string
  status?: 'active' | 'beta' | 'deprecated'

  // AI SDK settings
  config?: {
    mode?: 'auto' | 'json' | 'tool'
    [key: string]: any
  }
}

export interface Manifest {
  // Versioning
  version: string // e.g. v1.1234567890
  etag: string // Content hash
  generatedAt: string // ISO timestamp

  // Data
  providers: Provider[]
  models: Model[]
}
```

### Scoring Functions (Your Existing System)

```typescript
export function scoreIq(intelligenceIndex?: number): 0 | 1 | 2 | 3 | 4 | 5 {
  if (!intelligenceIndex)
    return 0
  if (intelligenceIndex >= 65)
    return 5
  if (intelligenceIndex >= 55)
    return 4
  if (intelligenceIndex >= 45)
    return 3
  if (intelligenceIndex >= 35)
    return 2
  if (intelligenceIndex >= 25)
    return 1
  return 0
}

export function scoreSpeed(tokensPerSec?: number): 0 | 1 | 2 | 3 | 4 | 5 {
  if (!tokensPerSec)
    return 0
  if (tokensPerSec >= 260)
    return 5
  if (tokensPerSec >= 180)
    return 4
  if (tokensPerSec >= 120)
    return 3
  if (tokensPerSec >= 60)
    return 2
  if (tokensPerSec >= 25)
    return 1
  return 0
}
```

### Capabilities strategy

- **Source of truth:** `packages/shared/src/capabilities.ts` - manually curated mapping by provider/model indicating capabilities like `vision`, `reasoning`, `toolUse`, `json`, `audio`, etc., plus `contextWindow`.
- **Server integration:** `transform.ts` merges capabilities from the mapping into each model during transformation.
- **Probe script:** `packages/server/scripts/probe-capabilities.ts` uses Vercel AI SDK to test real model capabilities. Run with `bun run probe` to verify/update the mapping.

### API Endpoints

- GET `/v1/manifest`
  - Returns full `Manifest`.
  - Headers:
    - Cache-Control: `public, max-age=600, s-maxage=86400, stale-while-revalidate=604800, stale-if-error=604800`
    - ETag: `<hash>`; honor `If-None-Match` with 304

- GET `/v1/providers`
  - Returns `Provider[]` subset from manifest.

- GET `/v1/providers/:providerId/models`
  - Returns `Model[]` for a provider.

- Optional: GET `/v1/version`
  - Returns `{ version, etag, generatedAt }` for cheap update checks.

- `getAllowedOrigin` reads `ALLOWED_ORIGINS` (comma-separated exact or `*.domain.com` patterns) and returns the requesting origin when allowed.
- `loadManifest` pulls the single JSON blob from Workers KV (`env.REGISTRY.get('manifest')`).
- Every response includes the unified cache header and ETag to leverage CDN revalidation.

### Runtime and env usage (Cloudflare Workers + Elysia)

We run on Cloudflare Workers using Elysia's Cloudflare adapter and the Workers `env` API for bindings:

```ts
import { env } from 'cloudflare:workers'
import { Elysia } from 'elysia'
import { CloudflareAdapter } from 'elysia/adapter/cloudflare-worker'

export default new Elysia({
  adapter: CloudflareAdapter,
})
  .get('/', async () => `Hello ${await env.REGISTRY.get('my-key')}`)
  // access envs with env.AA_API_KEY, etc.
  .compile()
```

### Update Pipeline (Cloudflare Cron)

- KV namespace: `REGISTRY`
- Store the serialized manifest at key `manifest`
- Cron (daily):
  1. Fetch AA with `AA_API_KEY`
  2. Transform to `Model` shape, compute `iq`/`speed`
  3. Dedupe providers from models
  4. Compute `etag` (content hash) and `version` (timestamp-hash)
  5. If ETag changed, `REGISTRY.put('manifest', JSON.stringify(manifest))` (idempotent; on failure keep previous)

Serving requests

- Read once from KV per request (edge will cache thanks to headers)
- Set Cache-Control and ETag
- If `If-None-Match` matches, return 304 without body

### GitHub publishing via GitHub Action (readable snapshot)

Publishing to GitHub is handled outside the Worker by a GitHub Action (so the Worker never touches GitHub):

- Files: `providers.json` and `models.json` (pretty-printed)
- Structure:
  - `providers.json`: Array of `Provider`
  - `models.json`: Array of `Model` (minimal fields: provider, value, name, alias, iq, speed, price (blended))

Action outline:

1. Trigger: scheduled (eg, daily) or manually.
2. Fetch the latest manifest from the deployed API (`GET /v1/manifest`).
3. Derive `providers.json` and `models.json` from the manifest.
4. If content changed (or ETag differs), commit with the repo `GITHUB_TOKEN`.

Let Git history be the history.

---

## Client Library

### Core API

These all have sensible defaults, only required option is `endpoint`.

```typescript
import { createRegistry } from '@rttnd/llm'

const registry = createRegistry({
  endpoint: 'https://models.yourdomain.com',

  cache: {
    ttl: 3600, // seconds
    storage: 'localStorage' // or 'memory'
  },

  filters: {
    providers: ['openai', 'anthropic', 'google'],
    exclude: {
      openai: ['gpt-4.1']
    },
    capabilities: ['vision', 'toolUse'],
    minIq: 3
    // ...
  },

  custom: {
    providers: [
      {
        value: 'custom',
        name: 'Custom Provider',
        keyPlaceholder: 'sk-custom-...'
      }
    ],
    models: [
      {
        value: 'my-custom-model',
        provider: 'custom',
        name: 'My Custom Model',
        iq: 4,
        speed: 3
      }
    ],
  },

  overrides: {
    aliases: {
      openai: {
        'gpt-5': 'GPT-5 (Latest)' // Rename models
      },
    }
  },

  autoRefresh: true,
})

// Fetch and cache manifest (call once on app init)
await registry.init()

// Get all providers
const providers = registry.getProviders()
// → [{ id: 'openai', name: 'OpenAI', ... }, ...]

// Get models for a provider
const models = registry.getModels('openai')
// → [{ id: '...', value: 'gpt-5', name: 'GPT-5', ... }, ...]

// Search/filter models
const filtered = registry.searchModels({
  provider: 'openai',
  minIq: 4,
  capabilities: ['vision', 'toolUse']
})

// Get single model by value
const model = registry.getModel('openai', 'gpt-5')

// Get model alias for display
const alias = registry.getModelAlias('openai', 'gpt-5')
// → 'GPT-5'

// Manual refresh
await registry.refresh()

// Check if update available
const hasUpdate = await registry.checkForUpdates()
```

### Eden Integration (Internal Use Only)

```typescript
import type { App } from './server' // Your Elysia app type
// Inside the library, use Eden for type-safe API calls
import { treaty } from '@elysiajs/eden'

const client = treaty<App>('https://models.yourdomain.com')

const { data, error } = await client.v1.manifest.get()
```

### Vercel AI SDK Bridge

```typescript
import { anthropic } from '@ai-sdk/anthropic'
import { google } from '@ai-sdk/google'
import { openai } from '@ai-sdk/openai'

export function toAiSdkModel(model: Model) {
  switch (model.provider) {
    case 'openai':
      return openai(model.value)
    case 'anthropic':
      return anthropic(model.value)
    case 'google':
      return google(model.value)
    case 'custom':
      return openai(model.value, { baseURL: 'https://api.custom-llm.com/v1' })
    default:
      throw new Error(`Unknown provider: ${model.provider}`)
  }
}
```

---

## CORS

- Env: `ALLOWED_ORIGINS="https://app1.com,https://app2.com,https://*.example.com"`
- Allow if origin matches exactly or wildcard suffix (e.g., `*.example.com`).
- If allowed, set:
  - `Access-Control-Allow-Origin: <origin>`
  - `Access-Control-Allow-Methods: GET, OPTIONS`
  - `Access-Control-Allow-Headers: Content-Type, If-None-Match`
  - `Vary: Origin`
- Respond to OPTIONS preflight accordingly.

## Envs

- `AA_API_KEY`: Artificial Analysis API key.
- `GITHUB_TOKEN`: repository token used by the GitHub Action to commit `providers.json`/`models.json` (the Worker does not need GitHub credentials).
- `ALLOWED_ORIGINS`: comma separated origins for CORS.

## Security Notes

- API is read-only; no user API keys touch the registry.
- Validate inputs with Elysia schema.
- Keep the cron job idempotent—on failure, leave the previous manifest untouched.

## Migration Path for Existing Apps

0. **Deploy**: Click the Deploy on Cloudflare button to set up a Worker with the backend.
1. **Install library**: `bun add @rttnd/llm`
2. **Replace hardcoded lists**: Use `registry.getProviders()` and `registry.getModels()`
3. **Keep existing UI**: Dropdown logic stays the same
4. **Update periodically**: Call `registry.refresh()` or set `autoRefresh: true`

---

## Testing

We use Vitest for both unit and integration tests.

- Unit tests:
  - Scoring functions (`scoreIq`, `scoreSpeed`) boundaries and bins
  - Stable JSON + ETag generation and conditional GET handling (304 path)
  - CORS origin matcher (`getAllowedOrigin`) including wildcard and exact matches
  - Transform logic from AA payload → `Model`/`Provider` (snapshot tests for stability)

- Integration tests:
  - Elysia allows testing endpoints without running the server:
    - `/v1/manifest` returns 200 with `Cache-Control` and `ETag`
    - `If-None-Match` yields 304 with no body
    - `/v1/providers` and `/v1/providers/:id/models` shape and filtering
    - `/v1/version` is light-weight and consistent with manifest

```typescript
import { Elysia } from 'elysia'
import { describe, expect, it } from 'vitest'

describe('Elysia', () => {
  it('returns a response', async () => {
    const app = new Elysia().get('/', () => 'hi')

    const response = await app
      .handle(new Request('http://localhost/'))
      .then(res => res.text())

    expect(response).toBe('hi')
  })
})
```

- CI:
  - Run Vitest on PRs and main.

## Future Enhancements

1. Auto-generate OpenAPI docs (Elysia plugin; CF node:fs workaround if needed).
2. Docs with Astro

---

## Package Structure

```txt
packages/
├── server/                 # Cloudflare Worker
│   ├── src/
│   │   ├── index.ts       # Elysia app
│   │   └── ...
│   ├── wrangler.toml
│   └── package.json
│
├── client/                 # TypeScript library
│   ├── src/
│   │   ├── index.ts       # Main API
│   │   └── ...
│   └── package.json
│
└── types/                  # Shared TypeScript types
    └── ...
```
