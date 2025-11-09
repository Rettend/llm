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

Search and filter models. You can combine filters.

```typescript
// Search by name
const { data: gptModels } = await registry.searchModels({
  name: 'gpt',
})

// Filter by provider
const { data: anthropicModels } = await registry.searchModels({
  provider: 'anthropic',
})

// Filter by capability
const { data: visionModels } = await registry.searchModels({
  capability: 'vision',
})

// Filter by performance
const { data: smartModels } = await registry.searchModels({
  minIq: 4, // IQ score >= 4
  minSpeed: 3, // Speed score >= 3
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
