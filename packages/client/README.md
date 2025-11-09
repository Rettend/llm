# @rttnd/llm

Type-safe client library for the LLM Registry API.

## Install

```bash
bun add @rttnd/llm
```

## Quick Start

```typescript
import { createLLMClient } from '@rttnd/llm'

const client = createLLMClient({
  baseUrl: 'https://llm.username.workers.dev',
})

const { data: models, error } = await client.getModels()
```

## Config

```typescript
const client = createLLMClient({
  baseUrl: 'https://llm.username.workers.dev',

  // Enable in-memory caching (default: true)
  enableCache: true,

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

## API Reference

### Get Manifest

Get the complete manifest with all providers and models:

```typescript
const { data, error, cached } = await client.getManifest()

// Force refresh
const { data } = await client.getManifest({ forceRefresh: true })
```

### Get Providers

Get all LLM providers:

```typescript
const { data: providers, error } = await client.getProviders()
```

### Get Models

Get all models:

```typescript
const { data: models, error } = await client.getModels()
```

### Get Provider Models

Get models for a specific provider:

```typescript
const { data: openAIModels, error } = await client.getProviderModels('openai')
```

### Get Specific Model

Get a single model by provider and value:

```typescript
const { data: model, error } = await client.getModel('openai', 'gpt-5')
```

### Search Models

Search and filter models. You can combine filters.

```typescript
// Search by name
const { data: gptModels } = await client.searchModels({
  name: 'gpt',
})

// Filter by provider
const { data: anthropicModels } = await client.searchModels({
  provider: 'anthropic',
})

// Filter by capability
const { data: visionModels } = await client.searchModels({
  capability: 'vision',
})

// Filter by performance
const { data: smartModels } = await client.searchModels({
  minIq: 4, // IQ score >= 4
  minSpeed: 3, // Speed score >= 3
})
```

### Other

Manually check for updates:

```typescript
const hasUpdates = await client.checkForUpdates()
```

Get current version info:

```typescript
const { data: version, error } = await client.getVersion()
```

### Cache Management

```typescript
// Clear cache manually
client.clearCache()

// Stop auto-refresh
client.stopAutoRefresh()

// Clean up resources
client.destroy()
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
