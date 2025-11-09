import type { Manifest, Model } from '@rttnd/llm-shared'
import { describe, expect, it, vi } from 'vitest'
import { createRegistry } from '../src/index'

const modelsFixture: Model[] = [
  {
    id: 'model-1',
    value: 'grok-4-fast-reasoning',
    provider: 'xai',
    name: 'Grok 4 Fast Reasoning',
    alias: 'Grok 4 Fast',
    capabilities: {
      vision: true,
      text: true,
    },
    iq: 4,
    speed: 4,
  },
  {
    id: 'model-2',
    value: 'k2-thinking',
    provider: 'kimi',
    name: 'Kimi K2 Thinking',
    alias: 'K2 Thinking',
    capabilities: {
      text: true,
    },
    iq: 5,
    speed: 2,
  },
]

const manifestFixture: Manifest = {
  version: 'v1.test',
  etag: 'W/"fixture"',
  generatedAt: '2025-01-01T00:00:00.000Z',
  providers: [],
  models: modelsFixture,
}

describe('lLMClient', () => {
  it('should create a client instance', () => {
    const client = createRegistry({
      baseUrl: 'https://llm-registry.workers.dev',
    })

    expect(client).toBeDefined()
    expect(client.getManifest).toBeDefined()
    expect(client.getProviders).toBeDefined()
    expect(client.getModels).toBeDefined()
    expect(client.getProviderModels).toBeDefined()
    expect(client.getModel).toBeDefined()
    expect(client.searchModels).toBeDefined()
    expect(client.getVersion).toBeDefined()
    expect(client.checkForUpdates).toBeDefined()
    expect(client.clearCache).toBeDefined()
    expect(client.stopAutoRefresh).toBeDefined()
    expect(client.destroy).toBeDefined()
  })

  it('should have correct default config', () => {
    const client = createRegistry({
      baseUrl: 'https://llm-registry.workers.dev',
    })

    expect(client.config.baseUrl).toBe('https://llm-registry.workers.dev')
    expect(client.config.enableCache).toBe(true)
    expect(client.config.autoRefreshInterval).toBe(600000)
  })

  it('should accept custom config', () => {
    const onUpdate = () => {}
    const onError = () => {}

    const client = createRegistry({
      baseUrl: 'https://custom.workers.dev',
      enableCache: false,
      autoRefreshInterval: 300000,
      onUpdate,
      onError,
    })

    expect(client.config.baseUrl).toBe('https://custom.workers.dev')
    expect(client.config.enableCache).toBe(false)
    expect(client.config.autoRefreshInterval).toBe(300000)
    expect(client.config.onUpdate).toBe(onUpdate)
    expect(client.config.onError).toBe(onError)
  })

  it('should clear cache', () => {
    const client = createRegistry({
      baseUrl: 'https://llm-registry.workers.dev',
    })

    // Set some cache
    client.cache.manifest = { version: 'test' } as any
    client.cache.version = 'test'
    client.cache.lastFetch = Date.now()

    // Clear cache
    client.clearCache()

    expect(client.cache.manifest).toBeNull()
    expect(client.cache.version).toBeNull()
    expect(client.cache.lastFetch).toBe(0)
  })

  it('should stop auto-refresh', () => {
    const client = createRegistry({
      baseUrl: 'https://llm-registry.workers.dev',
      autoRefreshInterval: 1000,
    })

    expect(client.refreshTimer).toBeDefined()

    client.stopAutoRefresh()

    expect(client.refreshTimer).toBeNull()
  })

  it('should destroy and clean up', () => {
    const client = createRegistry({
      baseUrl: 'https://llm-registry.workers.dev',
      autoRefreshInterval: 1000,
    })

    client.cache.manifest = { version: 'test' } as any

    client.destroy()

    expect(client.refreshTimer).toBeNull()
    expect(client.cache.manifest).toBeNull()
  })

  it('should not start auto-refresh when interval is 0', () => {
    const client = createRegistry({
      baseUrl: 'https://llm-registry.workers.dev',
      autoRefreshInterval: 0,
    })

    expect(client.refreshTimer).toBeNull()
  })

  it('should call search endpoint when available', async () => {
    const client = createRegistry({
      baseUrl: 'https://example.dev',
      autoRefreshInterval: 0,
    })

    const mockSearch = vi.fn().mockResolvedValue({
      data: [modelsFixture[0]],
      error: null,
      status: 200,
    })

    ;(client as any).api = {
      v1: {
        models: {
          search: {
            get: mockSearch,
          },
        },
        manifest: {
          get: vi.fn(),
        },
        providers: {
          get: vi.fn(),
        },
        version: {
          get: vi.fn(),
        },
      },
    }

    const result = await client.searchModels({ provider: 'xai' })

    expect(mockSearch).toHaveBeenCalledWith({
      query: {
        name: undefined,
        provider: 'xai',
        capability: undefined,
        minIq: undefined,
        minSpeed: undefined,
      },
    })
    expect(result.data).toEqual([modelsFixture[0]])
    expect(result.cached).toBe(false)
  })

  it('should fall back to cached manifest when search endpoint fails', async () => {
    const client = createRegistry({
      baseUrl: 'https://example.dev',
      autoRefreshInterval: 0,
    })

    const onError = vi.fn()
    client.config.onError = onError

    const mockSearch = vi.fn().mockResolvedValue({
      data: null,
      error: new Error('unavailable'),
      status: 500,
    })

    ;(client as any).api = {
      v1: {
        models: {
          search: {
            get: mockSearch,
          },
        },
        manifest: {
          get: vi.fn(),
        },
        providers: {
          get: vi.fn(),
        },
        version: {
          get: vi.fn(),
        },
      },
    }

    client.cache.manifest = manifestFixture

    const result = await client.searchModels({ provider: 'xai' })

    expect(onError).toHaveBeenCalled()
    expect(result.data).toEqual([modelsFixture[0]])
    expect(result.cached).toBe(true)
  })
})
