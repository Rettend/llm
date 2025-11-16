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
    expect(manifest?.version).toBe('v1.kv-test')

    const providers = await registry.getProviders()
    expect(providers).toHaveLength(2)

    const models = await registry.getModels()
    expect(models).toHaveLength(2)

    const providerModels = await registry.getProviderModels('openai')
    expect(providerModels).toHaveLength(1)
    expect(providerModels[0].value).toBe('gpt-5')

    const specificModel = await registry.getModel('anthropic', 'claude-4')
    expect(specificModel?.name).toBe('Claude 4')

    const visionModels = await registry.searchModels({ capability: 'vision' })
    expect(visionModels).toHaveLength(1)
    expect(visionModels[0].value).toBe('gpt-5')
  })

  it('handles missing or invalid manifest gracefully', async () => {
    const mock = createMockKV(null)
    const registry = createKVRegistry({ kv: mock.kv })

    expect(await registry.getManifest()).toBeNull()
    expect(await registry.getProviders()).toEqual([])
    expect(await registry.getModels()).toEqual([])

    mock.setValue('not-json')
    expect(await registry.getManifest()).toBeNull()
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
    expect(manifest?.models).toHaveLength(2)
  })
})
