import type { ModelSearchQuery } from '@rttnd/llm-shared'
import { cors } from '@elysiajs/cors'
import { openapi } from '@elysiajs/openapi'
import { filterModels } from '@rttnd/llm-shared'
import { Elysia, t } from 'elysia'
import { CloudflareAdapter } from 'elysia/adapter/cloudflare-worker'
import { apiDescription, healthDescription, manifestDescription, providerModelsDescription, providersDescription, searchModelsDescription, versionDescription } from './docs'
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
  .use(openapi({
    documentation: {
      info: {
        title: 'LLM Registry API',
        version: '1.0.0',
        description: apiDescription,
      },
      tags: [
        { name: 'Registry', description: 'Complete registry data' },
        { name: 'Providers', description: 'LLM provider information' },
        { name: 'Models', description: 'Model search and retrieval' },
        { name: 'System', description: 'System health and version info' },
      ],
      servers: [
        {
          url: 'https://llm.rettend.me',
          description: 'Production server',
        },
      ],
    },
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
    detail: {
      summary: 'Get complete manifest',
      description: manifestDescription,
      tags: ['Registry'],
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
    detail: {
      summary: 'List all providers',
      description: providersDescription,
      tags: ['Providers'],
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
    detail: {
      summary: 'Search models',
      description: searchModelsDescription,
      tags: ['Models'],
    },
  })

  .get('/v1/providers/:providerId/models', async ({ params, set, headers }) => {
    const manifest = await loadManifest()

    if (handleConditionalRequest(headers, set, manifest.etag))
      return

    return manifest.models.filter(model => model.provider === params.providerId)
  }, {
    params: t.Object({
      providerId: t.String({ description: 'Provider slug (e.g., "openai", "anthropic", "google")' }),
    }),
    response: {
      200: t.Array(modelSchema),
      304: t.Void(),
    },
    detail: {
      summary: 'Get models by provider',
      description: providerModelsDescription,
      tags: ['Models'],
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
    detail: {
      summary: 'Get version info',
      description: versionDescription,
      tags: ['System'],
    },
  })

  .get('/health', () => ({ status: 'ok' as const }), {
    response: healthSchema,
    detail: {
      summary: 'Health check',
      description: healthDescription,
      tags: ['System'],
    },
  })
  .compile()

export default app
