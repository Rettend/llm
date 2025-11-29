import type { Model } from '@rttnd/llm-shared'
import { describe, expect, it } from 'bun:test'
import { createApp } from '../src/app'
import { testManifest } from './fixtures'

function createTestApp(manifest = testManifest) {
  return createApp({
    loadManifest: async () => manifest,
  })
}

describe('API Endpoints', () => {
  describe('GET /health', () => {
    it('returns ok status', async () => {
      const app = createTestApp()
      const response = await app.handle(new Request('http://localhost/health'))
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({ status: 'ok' })
    })
  })

  describe('GET /v1/manifest', () => {
    it('returns the full manifest', async () => {
      const app = createTestApp()
      const response = await app.handle(new Request('http://localhost/v1/manifest'))
      const data = await response.json() as { version: string, providers: unknown[], models: unknown[] }

      expect(response.status).toBe(200)
      expect(data.version).toBe(testManifest.version)
      expect(data.providers).toHaveLength(testManifest.providers.length)
      expect(data.models).toHaveLength(testManifest.models.length)
    })

    it('returns 304 for matching etag', async () => {
      const app = createTestApp()
      const response = await app.handle(new Request('http://localhost/v1/manifest', {
        headers: { 'If-None-Match': testManifest.etag },
      }))

      expect(response.status).toBe(304)
    })
  })

  describe('GET /v1/providers', () => {
    it('returns all providers', async () => {
      const app = createTestApp()
      const response = await app.handle(new Request('http://localhost/v1/providers'))
      const data = await response.json() as { value: string }[]

      expect(response.status).toBe(200)
      expect(data).toHaveLength(4)
      expect(data.map(p => p.value)).toEqual(['openai', 'anthropic', 'google', 'xai'])
    })
  })

  describe('GET /v1/version', () => {
    it('returns version info', async () => {
      const app = createTestApp()
      const response = await app.handle(new Request('http://localhost/v1/version'))
      const data = await response.json() as { version: string, etag: string, generatedAt: string }

      expect(response.status).toBe(200)
      expect(data.version).toBe(testManifest.version)
      expect(data.etag).toBe(testManifest.etag)
      expect(data.generatedAt).toBe(testManifest.generatedAt)
    })
  })

  describe('GET /v1/providers/:providerId/models', () => {
    it('returns models for a specific provider', async () => {
      const app = createTestApp()
      const response = await app.handle(new Request('http://localhost/v1/providers/openai/models'))
      const data = await response.json() as Model[]

      expect(response.status).toBe(200)
      expect(data.length).toBeGreaterThan(0)
      expect(data.every(m => m.provider === 'openai')).toBe(true)
    })

    it('returns empty array for unknown provider', async () => {
      const app = createTestApp()
      const response = await app.handle(new Request('http://localhost/v1/providers/unknown/models'))
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual([])
    })
  })
})

describe('GET /v1/models/search', () => {
  describe('single filters', () => {
    it('filters by single provider', async () => {
      const app = createTestApp()
      const response = await app.handle(new Request('http://localhost/v1/models/search?provider=anthropic'))
      const data = await response.json() as Model[]

      expect(response.status).toBe(200)
      expect(data.length).toBeGreaterThan(0)
      expect(data.every(m => m.provider === 'anthropic')).toBe(true)
    })

    it('filters by single status', async () => {
      const app = createTestApp()
      const response = await app.handle(new Request('http://localhost/v1/models/search?status=latest'))
      const data = await response.json() as Model[]

      expect(response.status).toBe(200)
      expect(data.length).toBeGreaterThan(0)
      expect(data.every(m => m.status === 'latest')).toBe(true)
    })

    it('filters by preview status', async () => {
      const app = createTestApp()
      const response = await app.handle(new Request('http://localhost/v1/models/search?status=preview'))
      const data = await response.json() as Model[]

      expect(response.status).toBe(200)
      expect(data.length).toBeGreaterThan(0)
      expect(data.every(m => m.status === 'preview')).toBe(true)
    })

    it('filters by name (partial match)', async () => {
      const app = createTestApp()
      const response = await app.handle(new Request('http://localhost/v1/models/search?name=sonnet'))
      const data = await response.json() as Model[]

      expect(response.status).toBe(200)
      expect(data.length).toBeGreaterThan(0)
      expect(data.every(m => m.name.toLowerCase().includes('sonnet') || m.value.toLowerCase().includes('sonnet'))).toBe(true)
    })

    it('filters by capability', async () => {
      const app = createTestApp()
      const response = await app.handle(new Request('http://localhost/v1/models/search?capability=audio'))
      const data = await response.json() as Model[]

      expect(response.status).toBe(200)
      expect(data.length).toBeGreaterThan(0)
      expect(data.every(m => m.capabilities?.audio === true)).toBe(true)
    })

    it('filters by minIq', async () => {
      const app = createTestApp()
      const response = await app.handle(new Request('http://localhost/v1/models/search?minIq=5'))
      const data = await response.json() as Model[]

      expect(response.status).toBe(200)
      expect(data.length).toBeGreaterThan(0)
      expect(data.every(m => (m.iq ?? 0) >= 5)).toBe(true)
    })

    it('filters by minSpeed', async () => {
      const app = createTestApp()
      const response = await app.handle(new Request('http://localhost/v1/models/search?minSpeed=5'))
      const data = await response.json() as Model[]

      expect(response.status).toBe(200)
      expect(data.length).toBeGreaterThan(0)
      expect(data.every(m => (m.speed ?? 0) >= 5)).toBe(true)
    })

    it('filters by minContextWindow', async () => {
      const app = createTestApp()
      const response = await app.handle(new Request('http://localhost/v1/models/search?minContextWindow=500000'))
      const data = await response.json() as Model[]

      expect(response.status).toBe(200)
      expect(data.length).toBeGreaterThan(0)
      expect(data.every(m => (m.metrics?.contextWindow ?? 0) >= 500000)).toBe(true)
    })
  })

  describe('array filters (multiple values)', () => {
    it('filters by multiple providers', async () => {
      const app = createTestApp()
      const response = await app.handle(new Request('http://localhost/v1/models/search?provider=openai&provider=anthropic'))
      const data = await response.json() as Model[]

      expect(response.status).toBe(200)
      expect(data.length).toBeGreaterThan(0)

      const providers = new Set(data.map(m => m.provider))
      expect(providers.has('openai') || providers.has('anthropic')).toBe(true)
      expect(data.every(m => m.provider === 'openai' || m.provider === 'anthropic')).toBe(true)
    })

    it('filters by multiple statuses', async () => {
      const app = createTestApp()
      const response = await app.handle(new Request('http://localhost/v1/models/search?status=latest&status=preview'))
      const data = await response.json() as Model[]

      expect(response.status).toBe(200)
      expect(data.length).toBeGreaterThan(0)
      expect(data.every(m => m.status === 'latest' || m.status === 'preview')).toBe(true)
      // Should NOT include 'all' status models
      expect(data.some(m => m.status === 'all')).toBe(false)
    })

    it('filters by multiple capabilities (AND logic)', async () => {
      const app = createTestApp()
      const response = await app.handle(new Request('http://localhost/v1/models/search?capability=reasoning&capability=audio'))
      const data = await response.json() as Model[]

      expect(response.status).toBe(200)
      // All returned models must have BOTH reasoning AND audio
      expect(data.every(m => m.capabilities?.reasoning === true && m.capabilities?.audio === true)).toBe(true)
    })
  })

  describe('combined filters', () => {
    it('filters by provider AND status', async () => {
      const app = createTestApp()
      const response = await app.handle(new Request('http://localhost/v1/models/search?provider=openai&status=latest'))
      const data = await response.json() as Model[]

      expect(response.status).toBe(200)
      expect(data.length).toBeGreaterThan(0)
      expect(data.every(m => m.provider === 'openai' && m.status === 'latest')).toBe(true)
    })

    it('filters by multiple providers AND multiple statuses', async () => {
      const app = createTestApp()
      const response = await app.handle(new Request('http://localhost/v1/models/search?provider=openai&provider=anthropic&status=latest&status=preview'))
      const data = await response.json() as Model[]

      expect(response.status).toBe(200)
      expect(data.length).toBeGreaterThan(0)
      expect(data.every(m =>
        (m.provider === 'openai' || m.provider === 'anthropic')
        && (m.status === 'latest' || m.status === 'preview'),
      )).toBe(true)
    })

    it('filters by provider, status, and minIq', async () => {
      const app = createTestApp()
      const response = await app.handle(new Request('http://localhost/v1/models/search?provider=openai&status=latest&minIq=5'))
      const data = await response.json() as Model[]

      expect(response.status).toBe(200)
      expect(data.every(m =>
        m.provider === 'openai'
        && m.status === 'latest'
        && (m.iq ?? 0) >= 5,
      )).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('returns empty array when no models match', async () => {
      const app = createTestApp()
      const response = await app.handle(new Request('http://localhost/v1/models/search?provider=nonexistent'))
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual([])
    })

    it('returns all models when no filters provided', async () => {
      const app = createTestApp()
      const response = await app.handle(new Request('http://localhost/v1/models/search'))
      const data = await response.json() as Model[]

      expect(response.status).toBe(200)
      expect(data).toHaveLength(testManifest.models.length)
    })

    it('handles invalid minIq gracefully', async () => {
      const app = createTestApp()
      const response = await app.handle(new Request('http://localhost/v1/models/search?minIq=invalid'))
      const data = await response.json() as Model[]

      expect(response.status).toBe(200)
      // Should return all models since invalid number is ignored
      expect(data).toHaveLength(testManifest.models.length)
    })
  })
})

describe('Regression tests', () => {
  describe('status filter regression', () => {
    it('correctly filters by status=latest only', async () => {
      const app = createTestApp()
      const response = await app.handle(new Request('http://localhost/v1/models/search?provider=openai&status=latest'))
      const data = await response.json() as Model[]

      expect(response.status).toBe(200)
      // Must NOT include 'all' or 'preview' status models
      expect(data.every(m => m.status === 'latest')).toBe(true)
      expect(data.some(m => m.status === 'all')).toBe(false)
      expect(data.some(m => m.status === 'preview')).toBe(false)
    })

    it('correctly filters by status=preview only', async () => {
      const app = createTestApp()
      const response = await app.handle(new Request('http://localhost/v1/models/search?provider=anthropic&status=preview'))
      const data = await response.json() as Model[]

      expect(response.status).toBe(200)
      expect(data.length).toBeGreaterThan(0)
      expect(data.every(m => m.status === 'preview')).toBe(true)
    })
  })

  describe('multiple provider filter regression', () => {
    it('correctly filters by multiple providers', async () => {
      const app = createTestApp()
      const response = await app.handle(new Request('http://localhost/v1/models/search?provider=google&provider=xai'))
      const data = await response.json() as Model[]

      expect(response.status).toBe(200)
      expect(data.length).toBeGreaterThan(0)

      // Must include models from both providers
      const providers = new Set(data.map(m => m.provider))
      expect(providers.size).toBeGreaterThanOrEqual(1) // At least one of the providers
      expect(data.every(m => m.provider === 'google' || m.provider === 'xai')).toBe(true)

      // Must NOT include other providers
      expect(data.some(m => m.provider === 'openai')).toBe(false)
      expect(data.some(m => m.provider === 'anthropic')).toBe(false)
    })

    it('correctly combines multiple providers with status filter', async () => {
      const app = createTestApp()
      const response = await app.handle(new Request('http://localhost/v1/models/search?provider=openai&provider=anthropic&status=latest&status=preview'))
      const data = await response.json() as Model[]

      expect(response.status).toBe(200)

      // All models must be from openai OR anthropic
      expect(data.every(m => m.provider === 'openai' || m.provider === 'anthropic')).toBe(true)

      // All models must have status latest OR preview
      expect(data.every(m => m.status === 'latest' || m.status === 'preview')).toBe(true)

      // Must NOT include 'all' status
      expect(data.some(m => m.status === 'all')).toBe(false)
    })
  })
})
