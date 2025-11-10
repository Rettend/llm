/// <reference path="./env.d.ts" />

import type { Manifest } from '@rttnd/llm-shared'
import type { HTTPHeaders } from 'elysia'
import { env } from 'cloudflare:workers'

const CACHE_HEADER = 'public, max-age=600, s-maxage=86400, stale-while-revalidate=604800, stale-if-error=604800'

export function getAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin)
    return false

  const raw = env.ALLOWED_ORIGINS?.trim()

  if (!raw)
    return false

  if (raw === '*')
    return true

  const allowed = raw.split(',').map(o => o.trim()).filter(Boolean)

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

export async function loadManifest(): Promise<Manifest> {
  const cached = await env.REGISTRY.get('manifest', 'text')

  if (!cached)
    throw new Error('Manifest not found in KV storage')

  return JSON.parse(cached)
}

export function parseScore(value?: string): number | undefined {
  if (!value)
    return undefined

  const parsed = Number(value)
  if (Number.isNaN(parsed))
    return undefined

  return parsed
}

function normalizeEtagValue(etag: string): string {
  const trimmed = etag.trim()
  if (trimmed === '*')
    return '*'

  const withoutWeakPrefix = trimmed.startsWith('W/') ? trimmed.slice(2) : trimmed
  return withoutWeakPrefix.replace(/^"+|"+$/g, '')
}

function etagMatches(ifNoneMatch: string | undefined, currentEtag: string): boolean {
  if (!ifNoneMatch)
    return false

  const normalizedCurrent = normalizeEtagValue(currentEtag)

  return ifNoneMatch
    .split(',')
    .map(candidate => candidate.trim())
    .filter(candidate => candidate.length > 0)
    .some((candidate) => {
      if (candidate === '*')
        return true

      return normalizeEtagValue(candidate) === normalizedCurrent
    })
}

interface ResponseToolkit {
  headers: HTTPHeaders
  status?: number | string
}

export function applyCachingHeaders(set: ResponseToolkit, etag: string): void {
  set.headers['cache-control'] = CACHE_HEADER
  set.headers.etag = etag
}

export function handleConditionalRequest(headers: Record<string, string | undefined>, set: ResponseToolkit, etag: string): boolean {
  if (etagMatches(headers['if-none-match'], etag)) {
    set.status = 304
    applyCachingHeaders(set, etag)
    return true
  }

  applyCachingHeaders(set, etag)
  return false
}
