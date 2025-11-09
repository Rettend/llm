import type { ModelSearchQuery } from '@rttnd/llm-shared'
import { cors } from '@elysiajs/cors'
import { filterModels } from '@rttnd/llm-shared'
import { Elysia, t } from 'elysia'
import { CloudflareAdapter } from 'elysia/adapter/cloudflare-worker'
import { healthSchema, manifestSchema, modelSchema, modelSearchQuerySchema, providerSchema, versionSchema } from './schema'
import { applyCachingHeaders, getAllowedOrigin, handleConditionalRequest, loadManifest, parseScore } from './utils'

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

    if (handleConditionalRequest(headers, set, manifest.etag))
      return

    return manifest
  }, {
    response: {
      200: manifestSchema,
      304: t.Void(),
    },
  })

  .get('/v1/providers', async ({ set, headers }) => {
    const manifest = await loadManifest()

    if (handleConditionalRequest(headers, set, manifest.etag))
      return

    return manifest.providers
  }, {
    response: {
      200: t.Array(providerSchema),
      304: t.Void(),
    },
  })

  .get('/v1/models/search', async ({ query, set }) => {
    const manifest = await loadManifest()

    applyCachingHeaders(set, manifest.etag)

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

  .get('/v1/providers/:providerId/models', async ({ params, set, headers }) => {
    const manifest = await loadManifest()

    if (handleConditionalRequest(headers, set, manifest.etag))
      return

    return manifest.models.filter(model => model.provider === params.providerId)
  }, {
    params: t.Object({
      providerId: t.String(),
    }),
    response: {
      200: t.Array(modelSchema),
      304: t.Void(),
    },
  })

  .get('/v1/version', async ({ set, headers }) => {
    const manifest = await loadManifest()

    if (handleConditionalRequest(headers, set, manifest.etag))
      return

    const { version, etag, generatedAt } = manifest
    return { version, etag, generatedAt }
  }, {
    response: {
      200: versionSchema,
      304: t.Void(),
    },
  })

  .get('/health', () => ({ status: 'ok' as const }), {
    response: healthSchema,
  })
  .compile()

export default app
