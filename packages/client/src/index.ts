import type { app } from '@rttnd/llm-server'
import type { Manifest, Model, ModelSearchQuery, Provider } from '@rttnd/llm-shared'
import type { Storage } from 'unstorage'
import process from 'node:process'
import { treaty } from '@elysiajs/eden'
import { filterModels } from '@rttnd/llm-shared'
import { createStorage } from 'unstorage'

export * from '@rttnd/llm-shared'

export type CacheMode = 'auto' | 'localStorage' | 'fs' | 'none'

export interface LLMClientConfig {
  /**
   * Base URL of the LLM Registry API
   * @default 'https://llm-registry.your-subdomain.workers.dev'
   */
  baseUrl: string

  /**
   * Persist cache entries between sessions
   * @default 'auto'
   */
  cache?: CacheMode

  /**
   * Auto-refresh interval in milliseconds
   * Set to 0 to disable auto-refresh
   * @default 600000 (10 minutes)
   */
  autoRefreshInterval?: number

  /**
   * Custom fetch options
   */
  fetchOptions?: RequestInit

  /**
   * Custom headers to include in requests
   */
  headers?: Record<string, string> | (() => Record<string, string>)

  /**
   * Callback when manifest is updated
   */
  onUpdate?: (manifest: Manifest) => void

  /**
   * Callback when an error occurs
   */
  onError?: (error: Error) => void
}

export interface LLMClientResponse<T> {
  data: T | null
  error: Error | null
  cached: boolean
}

interface PersistedMeta {
  version: string | null
  etag: string | null
  generatedAt: string | null
  updatedAt: number | null
}

type ResolvedCacheMode = Exclude<CacheMode, 'auto'>

const CACHE_SCHEMA_VERSION = '1'
const STORAGE_NAMESPACE = 'llm-registry-cache'
const MANIFEST_KEY = 'manifest'
const META_KEY = 'meta'

function isLocalStorageAvailable(): boolean {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined')
    return false

  try {
    const probeKey = '__llm_registry_probe__'
    window.localStorage.setItem(probeKey, probeKey)
    window.localStorage.removeItem(probeKey)
    return true
  }
  catch {
    return false
  }
}

function isNodeLike(): boolean {
  if (typeof process === 'undefined')
    return false

  const versions = process.versions ?? {}
  return Boolean(versions.node || versions.bun || versions.deno)
}

function resolveCacheMode(mode: CacheMode | undefined): ResolvedCacheMode {
  const requested = mode ?? 'auto'

  if (requested === 'localStorage')
    return isLocalStorageAvailable() ? 'localStorage' : 'none'

  if (requested === 'fs')
    return isNodeLike() ? 'fs' : 'none'

  if (requested === 'none')
    return 'none'

  if (isLocalStorageAvailable())
    return 'localStorage'

  return isNodeLike() ? 'fs' : 'none'
}

async function hashBaseUrl(baseUrl: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const data = new TextEncoder().encode(baseUrl)
    const digest = await crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('')
  }

  return baseUrl.replace(/[^a-z0-9]/gi, '').slice(0, 48) || 'default'
}

export class LLMClient {
  public config: Required<LLMClientConfig>
  public cache: {
    manifest: Manifest | null
    version: string | null
    etag: string | null
    generatedAt: string | null
    lastFetch: number
  }

  public refreshTimer: Timer | null = null
  private api: ReturnType<typeof treaty<typeof app>>
  private readonly requestedCacheMode: CacheMode
  private persistenceMode: ResolvedCacheMode
  private storage: Storage | null = null
  private namespace = ''
  private ready: Promise<void>

  constructor(config: LLMClientConfig) {
    this.config = {
      cache: 'auto',
      autoRefreshInterval: 600000, // 10 minutes
      fetchOptions: {},
      headers: {},
      onUpdate: () => {},
      onError: () => {},
      ...config,
    }

    this.requestedCacheMode = this.config.cache ?? 'auto'
    this.persistenceMode = resolveCacheMode(this.config.cache)

    this.cache = {
      manifest: null,
      version: null,
      etag: null,
      generatedAt: null,
      lastFetch: 0,
    }

    this.api = treaty<typeof app>(this.config.baseUrl, {
      fetch: this.config.fetchOptions,
      headers: typeof this.config.headers === 'function'
        ? this.config.headers()
        : this.config.headers,
    })

    if (this.persistenceMode === 'none' && this.requestedCacheMode !== 'auto' && this.requestedCacheMode !== 'none') {
      queueMicrotask(() => {
        this.config.onError(new Error(`Requested cache mode "${this.requestedCacheMode}" is unavailable in this environment; caching disabled.`))
      })
    }

    this.ready = this.initializePersistence()
    this.ready.catch(() => {})

    if (this.config.autoRefreshInterval > 0) {
      this.ready
        .then(() => this.startAutoRefresh())
        .catch(error => this.config.onError(error instanceof Error ? error : new Error(String(error))))
    }
  }

  /**
   * Get the complete manifest with all providers and models
   */
  async getManifest(options?: { forceRefresh?: boolean }): Promise<LLMClientResponse<Manifest>> {
    await this.ready

    try {
      if (this.cache.manifest && !options?.forceRefresh) {
        return {
          data: this.cache.manifest,
          error: null,
          cached: true,
        }
      }

      const { data, error, status } = await this.api.v1.manifest.get()

      if (error || !data) {
        const err = new Error(`Failed to fetch manifest: ${status}`)
        this.config.onError(err)

        if (this.cache.manifest && !options?.forceRefresh) {
          return {
            data: this.cache.manifest,
            error: null,
            cached: true,
          }
        }

        return { data: null, error: err, cached: false }
      }

      this.setMemoryCache(data)
      await this.persistManifest(data)

      return { data, error: null, cached: false }
    }
    catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      this.config.onError(error)

      if (this.cache.manifest && !options?.forceRefresh) {
        return {
          data: this.cache.manifest,
          error: null,
          cached: true,
        }
      }

      return { data: null, error, cached: false }
    }
  }

  /**
   * Get all providers
   */
  async getProviders(options?: { forceRefresh?: boolean }): Promise<LLMClientResponse<Provider[]>> {
    await this.ready

    try {
      if (this.cache.manifest && !options?.forceRefresh) {
        return {
          data: this.cache.manifest.providers,
          error: null,
          cached: true,
        }
      }

      const { data, error, status } = await this.api.v1.providers.get()

      if (error || !data) {
        const err = new Error(`Failed to fetch providers: ${status}`)
        this.config.onError(err)
        return { data: null, error: err, cached: false }
      }

      return { data, error: null, cached: false }
    }
    catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      this.config.onError(error)
      return { data: null, error, cached: false }
    }
  }

  /**
   * Get models for a specific provider
   */
  async getProviderModels(
    providerId: string,
    options?: { forceRefresh?: boolean },
  ): Promise<LLMClientResponse<Model[]>> {
    await this.ready

    try {
      if (this.cache.manifest && !options?.forceRefresh) {
        const models = this.cache.manifest.models.filter(m => m.provider === providerId)
        return {
          data: models,
          error: null,
          cached: true,
        }
      }

      const { data, error, status } = await this.api.v1.providers({ providerId }).models.get()

      if (error || !data) {
        const err = new Error(`Failed to fetch models for provider ${providerId}: ${status}`)
        this.config.onError(err)
        return { data: null, error: err, cached: false }
      }

      return { data, error: null, cached: false }
    }
    catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      this.config.onError(error)
      return { data: null, error, cached: false }
    }
  }

  /**
   * Get all models
   */
  async getModels(options?: { forceRefresh?: boolean }): Promise<LLMClientResponse<Model[]>> {
    const manifestResponse = await this.getManifest(options)
    if (manifestResponse.error || !manifestResponse.data) {
      return {
        data: null,
        error: manifestResponse.error || new Error('Failed to get manifest'),
        cached: false,
      }
    }

    return {
      data: manifestResponse.data.models,
      error: null,
      cached: manifestResponse.cached,
    }
  }

  /**
   * Check for updates and refresh cache if needed
   */
  async checkForUpdates(): Promise<boolean> {
    await this.ready

    try {
      const { data, error } = await this.api.v1.version.get()

      if (error || !data)
        return false

      if (this.cache.version && data.version !== this.cache.version) {
        const manifestResponse = await this.getManifest({ forceRefresh: true })
        return manifestResponse.error === null
      }

      return false
    }
    catch {
      return false
    }
  }

  /**
   * Get current version info
   */
  async getVersion(): Promise<LLMClientResponse<{ version: string, etag: string, generatedAt: string }>> {
    await this.ready

    try {
      const { data, error, status } = await this.api.v1.version.get()

      if (error || !data) {
        const err = new Error(`Failed to fetch version: ${status}`)
        this.config.onError(err)
        return { data: null, error: err, cached: false }
      }

      this.cache.version = data.version
      this.cache.etag = data.etag
      this.cache.generatedAt = data.generatedAt

      return { data, error: null, cached: false }
    }
    catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      this.config.onError(error)
      return { data: null, error, cached: false }
    }
  }

  /**
   * Get a specific model by provider and value
   */
  async getModel(
    providerId: string,
    modelValue: string,
    options?: { forceRefresh?: boolean },
  ): Promise<LLMClientResponse<Model>> {
    const modelsResponse = await this.getProviderModels(providerId, options)

    if (modelsResponse.error || !modelsResponse.data) {
      return {
        data: null,
        error: modelsResponse.error || new Error('Failed to get models'),
        cached: false,
      }
    }

    const model = modelsResponse.data.find(m => m.value === modelValue)

    if (!model) {
      return {
        data: null,
        error: new Error(`Model ${modelValue} not found for provider ${providerId}`),
        cached: modelsResponse.cached,
      }
    }

    return {
      data: model,
      error: null,
      cached: modelsResponse.cached,
    }
  }

  /**
   * Search models by name, provider, or capabilities
   */
  async searchModels(
    query: ModelSearchQuery,
    options?: { forceRefresh?: boolean },
  ): Promise<LLMClientResponse<Model[]>> {
    await this.ready

    try {
      const { data, error, status } = await this.api.v1.models.search.get({
        query: {
          name: query.name,
          provider: query.provider,
          capability: query.capability,
          minIq: query.minIq !== undefined ? String(query.minIq) : undefined,
          minSpeed: query.minSpeed !== undefined ? String(query.minSpeed) : undefined,
        },
      })

      if (!error && data !== undefined && data !== null) {
        return {
          data,
          error: null,
          cached: false,
        }
      }

      if (error) {
        const requestError = error instanceof Error
          ? error
          : new Error(`Model search failed with status ${status}`)
        this.config.onError(requestError)
      }
    }
    catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      this.config.onError(error)
    }
    const cachedManifest = !options?.forceRefresh
      ? this.cache.manifest
      : null

    if (cachedManifest) {
      return {
        data: filterModels(cachedManifest.models, query),
        error: null,
        cached: true,
      }
    }

    const modelsResponse = await this.getModels(options)

    if (modelsResponse.error || !modelsResponse.data)
      return modelsResponse

    return {
      data: filterModels(modelsResponse.data, query),
      error: null,
      cached: modelsResponse.cached,
    }
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.manifest = null
    this.cache.version = null
    this.cache.etag = null
    this.cache.generatedAt = null
    this.cache.lastFetch = 0
    void this.clearPersistentCache()
  }

  /**
   * Start auto-refresh timer
   */
  private startAutoRefresh(): void {
    if (this.refreshTimer)
      clearInterval(this.refreshTimer)

    this.refreshTimer = setInterval(() => {
      this.checkForUpdates().catch(err => this.config.onError(err))
    }, this.config.autoRefreshInterval)
  }

  /**
   * Stop auto-refresh timer
   */
  stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer)
      this.refreshTimer = null
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stopAutoRefresh()
    this.clearCache()
    void this.ready.then(() => this.disposeStorage())
  }

  private async initializePersistence(): Promise<void> {
    try {
      this.namespace = await hashBaseUrl(this.config.baseUrl)

      const storage = await this.createStorage(this.persistenceMode)
      this.storage = storage

      if (!storage)
        return

      const [manifest, meta] = await Promise.all([
        storage.getItem<Manifest | null>(MANIFEST_KEY),
        storage.getItem<PersistedMeta | null>(META_KEY),
      ])

      if (manifest && meta && meta.version === manifest.version) {
        this.cache.manifest = manifest
        this.cache.version = meta.version
        this.cache.etag = meta.etag ?? manifest.etag ?? null
        this.cache.generatedAt = meta.generatedAt ?? manifest.generatedAt ?? null
        this.cache.lastFetch = meta.updatedAt ?? Date.now()
      }
    }
    catch (error) {
      this.disablePersistence(error)
    }
  }

  private async createStorage(mode: ResolvedCacheMode): Promise<Storage | null> {
    if (mode === 'none')
      return null

    if (mode === 'localStorage') {
      if (!isLocalStorageAvailable())
        return null

      const { default: localStorageDriver } = await import('unstorage/drivers/localstorage')

      return createStorage({
        driver: localStorageDriver({ base: `${STORAGE_NAMESPACE}:${CACHE_SCHEMA_VERSION}:${this.namespace}` }),
      })
    }

    if (!isNodeLike())
      return null

    const [{ default: fsDriver }, pathModule, osModule, fsPromises] = await Promise.all([
      import('unstorage/drivers/fs-lite'),
      import('node:path'),
      import('node:os'),
      import('node:fs/promises'),
    ])

    const base = pathModule.join(osModule.tmpdir(), STORAGE_NAMESPACE, CACHE_SCHEMA_VERSION, this.namespace)
    await fsPromises.mkdir(base, { recursive: true })

    return createStorage({
      driver: fsDriver({ base }),
    })
  }

  private setMemoryCache(manifest: Manifest): void {
    const wasEmpty = !this.cache.manifest
    const versionChanged = this.cache.version !== manifest.version
    const etagChanged = this.cache.etag !== manifest.etag

    this.cache.manifest = manifest
    this.cache.version = manifest.version
    this.cache.etag = manifest.etag
    this.cache.generatedAt = manifest.generatedAt
    this.cache.lastFetch = Date.now()

    if (wasEmpty || versionChanged || etagChanged)
      this.config.onUpdate(manifest)
  }

  private async persistManifest(manifest: Manifest): Promise<void> {
    if (!this.storage)
      return

    const meta: PersistedMeta = {
      version: manifest.version ?? null,
      etag: manifest.etag ?? null,
      generatedAt: manifest.generatedAt ?? null,
      updatedAt: Date.now(),
    }

    try {
      await Promise.all([
        this.storage.setItem(MANIFEST_KEY, manifest),
        this.storage.setItem(META_KEY, meta),
      ])
    }
    catch (error) {
      this.disablePersistence(error)
    }
  }

  private async clearPersistentCache(): Promise<void> {
    if (!this.storage)
      return

    try {
      await Promise.all([
        this.storage.removeItem(MANIFEST_KEY),
        this.storage.removeItem(META_KEY),
      ])
    }
    catch (error) {
      this.disablePersistence(error)
    }
  }

  private async disposeStorage(): Promise<void> {
    if (!this.storage)
      return

    const storage = this.storage as Storage & { dispose?: () => Promise<void> | void }
    this.storage = null

    if (typeof storage.dispose === 'function') {
      try {
        await storage.dispose()
      }
      catch (error) {
        this.config.onError(error instanceof Error ? error : new Error(String(error)))
      }
    }
  }

  private disablePersistence(error: unknown): void {
    this.storage = null
    this.persistenceMode = 'none'

    const err = error instanceof Error ? error : new Error(String(error))
    const disabledError = new Error(`Persistent cache disabled: ${err.message}`)
    Object.assign(disabledError, { cause: err })
    this.config.onError(disabledError)
  }
}

/**
 * Create a new LLM client instance
 */
export function createRegistry(config: LLMClientConfig): LLMClient {
  return new LLMClient(config)
}
