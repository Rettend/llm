import type { Manifest, ModelSearchQuery } from '@rttnd/llm-shared'
import { cors } from '@elysiajs/cors'
import { filterModels } from '@rttnd/llm-shared'
import { env } from 'cloudflare:workers'
import { Elysia, t } from 'elysia'
import { CloudflareAdapter } from 'elysia/adapter/cloudflare-worker'
import { healthSchema, manifestSchema, modelSchema, modelSearchQuerySchema, providerSchema, versionSchema } from './schema'

const CACHE_HEADER = 'public, max-age=600, s-maxage=86400, stale-while-revalidate=604800, stale-if-error=604800'

function getAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin)
    return false

  const allowed = env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) ?? []

  for (const pattern of allowed) {
    if (pattern === origin)
      return true

    if (pattern.startsWith('*.')) {
      const domain = pattern.slice(2)
      if (origin.endsWith(domain))
        return true
    }
  }

  return false
}

async function loadManifest(): Promise<Manifest> {
  const cached = await env.REGISTRY.get('manifest', 'text')

  if (!cached)
    throw new Error('Manifest not found in KV storage')

  return JSON.parse(cached)
}

function parseScore(value?: string): number | undefined {
  if (!value)
    return undefined

  const parsed = Number(value)
  if (Number.isNaN(parsed))
    return undefined

  return parsed
}

export const app = new Elysia({
  adapter: CloudflareAdapter,
})
  .use(cors({
    origin: getAllowedOrigin,
    methods: ['GET', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'If-None-Match'],
  }))
  .get('/v1/manifest', async ({ set, headers }) => {
    const manifest = await loadManifest()

    const etag = manifest.etag
    if (headers['if-none-match'] === etag) {
      set.status = 304
      set.headers['cache-control'] = CACHE_HEADER
      set.headers.etag = etag
      return
    }

    set.headers['cache-control'] = CACHE_HEADER
    set.headers.etag = etag

    return manifest
  }, {
    response: {
      200: manifestSchema,
      304: t.Void(),
    },
  })

  .get('/v1/providers', async ({ set }) => {
    const manifest = await loadManifest()

    set.headers['cache-control'] = CACHE_HEADER

    return manifest.providers
  }, {
    response: t.Array(providerSchema),
  })

  .get('/v1/models/search', async ({ query, set }) => {
    const manifest = await loadManifest()

    set.headers['cache-control'] = CACHE_HEADER

    const searchQuery: ModelSearchQuery = {
      name: query.name,
      provider: query.provider,
      capability: query.capability,
      minIq: parseScore(query.minIq),
      minSpeed: parseScore(query.minSpeed),
    }

    return filterModels(manifest.models, searchQuery)
  }, {
    query: modelSearchQuerySchema,
    response: t.Array(modelSchema),
  })

  .get('/v1/providers/:providerId/models', async ({ params, set }) => {
    const manifest = await loadManifest()

    set.headers['cache-control'] = CACHE_HEADER

    return manifest.models.filter(model => model.provider === params.providerId)
  }, {
    params: t.Object({
      providerId: t.String(),
    }),
    response: t.Array(modelSchema),
  })

  .get('/v1/version', async ({ set }) => {
    const { version, etag, generatedAt } = await loadManifest()

    set.headers['cache-control'] = CACHE_HEADER

    return { version, etag, generatedAt }
  }, {
    response: versionSchema,
  })

  .get('/health', () => ({ status: 'ok' as const }), {
    response: healthSchema,
  })
  .compile()

export default app
