import type { Manifest } from '@rttnd/llm-shared'
import { describe, expect, it, vi } from 'vitest'
import { createKVRegistry } from '../src/kv'

const manifestFixture: Manifest = {
  version: 'v1.kv-test',
  etag: 'W/"kv"',
  generatedAt: '2025-01-01T00:00:00.000Z',
  providers: [
    { value: 'openai', name: 'OpenAI' },
    { value: 'anthropic', name: 'Anthropic' },
  ],
  models: [
    {
      id: 'model-openai',
      value: 'gpt-5',
      provider: 'openai',
      name: 'GPT-5',
      capabilities: { text: true, vision: true },
      iq: 5,
      speed: 4,
    },
    {
      id: 'model-anthropic',
      value: 'claude-4',
      provider: 'anthropic',
      name: 'Claude 4',
      capabilities: { text: true },
      iq: 4,
      speed: 3,
    },
  ],
}

function createMockKV(initialValue: string | null) {
  let value = initialValue

  return {
    setValue(next: string | null) {
      value = next
    },
    kv: {
      async get(_key: string, _type: 'text') {
        return value
      },
    },
  }
}

describe('kVRegistry', () => {
  it('returns manifest and derived collections', async () => {
    const { kv } = createMockKV(JSON.stringify(manifestFixture))
    const registry = createKVRegistry({ kv })

    const manifest = await registry.getManifest()
    expect(manifest.data?.version).toBe('v1.kv-test')
    expect(manifest.error).toBeNull()

    const providers = await registry.getProviders()
    expect(providers.data).toHaveLength(2)

    const models = await registry.getModels()
    expect(models.data).toHaveLength(2)

    const providerModels = await registry.getProviderModels('openai')
    expect(providerModels.data).toHaveLength(1)
    expect(providerModels.data?.[0]?.value).toBe('gpt-5')

    const specificModel = await registry.getModel('anthropic', 'claude-4')
    expect(specificModel.data?.name).toBe('Claude 4')

    const visionModels = await registry.searchModels({ capability: 'vision' })
    expect(visionModels.data).toHaveLength(1)
    expect(visionModels.data?.[0]?.value).toBe('gpt-5')
  })

  it('handles missing or invalid manifest gracefully', async () => {
    const mock = createMockKV(null)
    const registry = createKVRegistry({ kv: mock.kv })

    const emptyManifest = await registry.getManifest()
    expect(emptyManifest.data).toBeNull()
    expect(emptyManifest.error).toBeInstanceOf(Error)

    const providers = await registry.getProviders()
    expect(providers.data).toBeNull()
    expect(providers.error).toBeInstanceOf(Error)

    const models = await registry.getModels()
    expect(models.data).toBeNull()
    expect(models.error).toBeInstanceOf(Error)

    mock.setValue('not-json')
    const invalidManifest = await registry.getManifest()
    expect(invalidManifest.data).toBeNull()
    expect(invalidManifest.error).toBeInstanceOf(Error)
  })

  it('supports custom manifest keys', async () => {
    const mockGet = vi.fn(async (key: string, _type: 'text') => {
      return key === 'custom-key' ? JSON.stringify(manifestFixture) : null
    })

    const registry = createKVRegistry({
      kv: { get: mockGet },
      manifestKey: 'custom-key',
    })

    const manifest = await registry.getManifest()
    expect(mockGet).toHaveBeenCalledWith('custom-key', 'text')
    expect(manifest.data?.models).toHaveLength(2)
  })
})
