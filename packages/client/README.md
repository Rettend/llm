# @rttnd/llm

Type-safe client library for the LLM Registry API.

## Install

```bash
bun add @rttnd/llm
```

## Quick Start

```typescript
import { createRegistry } from '@rttnd/llm'

const registry = createRegistry({
  baseUrl: 'https://llm.username.workers.dev',
})

const { data: models, error } = await registry.getModels()
```

## Direct KV access

When your app already runs on Cloudflare Workers you can skip HTTP requests entirely and read the manifest straight from the shared KV namespace:

```ts
import { createKVRegistry } from '@rttnd/llm'

export default {
  async fetch(request, env) {
    const registry = createKVRegistry({ kv: env.REGISTRY })
    const models = await registry.getModels()
    return Response.json(models)
  },
}
```

- Works inside Server Functions with meta frameworks that use Nitro.
- Override `manifestKey` if you store multiple manifests in the same namespace.
- KV namespace IDs are safe to keep in your repo; they only work inside accounts that bind them via Cloudflare dashboard.

## Config

```typescript
const registry = createRegistry({
  baseUrl: 'https://llm.username.workers.dev',

  // Persist cache across sessions (default: 'auto')
  // Options: 'auto' | 'localStorage' | 'fs' | 'none'
  cache: 'auto',

  // Auto-refresh interval in ms (default: 600000 = 10 minutes)
  // Set to 0 to disable auto-refresh
  autoRefreshInterval: 600000,

  // Custom fetch options
  fetchOptions: {
    credentials: 'include',
  },

  // Custom headers (object or function)
  headers: {
    'X-Custom-Header': 'value',
  },
  // Or as a function for dynamic headers
  headers: () => ({
    Authorization: `Bearer ${getToken()}`,
  }),

  // Callback when manifest is updated
  onUpdate: (manifest) => {
    // ...
  },

  // Callback when an error occurs
  onError: (error) => {
    console.error('Registry error:', error)
  },
})
```

### Cache modes

- `auto` (default): uses `localStorage` in browsers, falls back to a filesystem cache in Node/Bun via the OS temp directory, otherwise disables persistence.
- `localStorage`: forces the browser driver. Useful when bundling for the web and you want deterministic behaviour.
- `fs`: forces the filesystem driver. Great for CLIs, workers, or long-running services that need warm starts.
- `none`: disables persistence entirely while keeping the in-memory hot cache for the current instance.

Under the hood the client uses [`unstorage`](https://github.com/unjs/unstorage) and always keeps an in-process cache layer for fast reads—even when persistence is disabled.

## API Reference

### Get Manifest

Get the complete manifest with all providers and models:

```typescript
const { data, error, cached } = await registry.getManifest()

// Force refresh
const { data } = await registry.getManifest({ forceRefresh: true })
```

### Get Providers

Get all LLM providers:

```typescript
const { data: providers, error } = await registry.getProviders()
```

### Get Models

Get all models:

```typescript
const { data: models, error } = await registry.getModels()
```

### Get Provider Models

Get models for a specific provider:

```typescript
const { data: openAIModels, error } = await registry.getProviderModels('openai')
```

### Get Specific Model

Get a single model by provider and value:

```typescript
const { data: model, error } = await registry.getModel('openai', 'gpt-5')
```

### Search Models

Search and filter models using various criteria. All filters are optional and can be combined.

#### Search Options

- `name` (string): Filter by partial match on model name, value, or alias (case-insensitive).
- `provider` (string): Filter by provider slug (e.g., "openai", "anthropic").
- `capability` (CapabilityKey | CapabilityKey[]): Require models that support the specified capability, or all listed capabilities if an array.
- `status` (Status | Status[]): Filter by model status ("latest", "preview", "all").
- `releaseDateFrom` (string | Date): Filter models released on or after this date.
- `releaseDateTo` (string | Date): Filter models released on or before this date.
- `minIq` (number): Minimum IQ score (0-5).
- `minSpeed` (number): Minimum speed score (0-5).
- `minContextWindow` (number): Minimum context window in tokens.
- `mode` (ModelMode): Filter by AI SDK config mode ("auto", "json", "tool").

```typescript
// Example: search by provider
const { data: models } = await registry.searchModels({
  provider: 'google'
})
```

### Other

Manually check for updates:

```typescript
const hasUpdates = await registry.checkForUpdates()
```

Get current version info:

```typescript
const { data: version, error } = await registry.getVersion()
```

### Cache Management

```typescript
// Clear cache manually
registry.clearCache()

// Stop auto-refresh
registry.stopAutoRefresh()

// Clean up resources
registry.destroy()
```

## Response Format

All methods return a consistent response format:

```typescript
interface LLMClientResponse<T> {
  data: T | null
  error: Error | null
  cached: boolean
}
```
