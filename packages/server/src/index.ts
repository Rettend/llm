import type { Manifest } from '@rttnd/llm-shared'
import { cors } from '@elysiajs/cors'
import { env } from 'cloudflare:workers'
import { Elysia, t } from 'elysia'
import { CloudflareAdapter } from 'elysia/adapter/cloudflare-worker'

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
  })

  .get('/v1/providers', async ({ set }) => {
    const manifest = await loadManifest()

    set.headers['cache-control'] = CACHE_HEADER

    return manifest.providers
  })

  .get('/v1/providers/:providerId/models', async ({ params, set }) => {
    const manifest = await loadManifest()

    set.headers['cache-control'] = CACHE_HEADER

    return manifest.models.filter(model => model.provider === params.providerId)
  }, {
    params: t.Object({
      providerId: t.String(),
    }),
  })

  .get('/v1/version', async ({ set }) => {
    const { version, etag, generatedAt } = await loadManifest()

    set.headers['cache-control'] = CACHE_HEADER

    return { version, etag, generatedAt }
  })

  .get('/health', () => ({ status: 'ok' }))
  .compile()

export default app
