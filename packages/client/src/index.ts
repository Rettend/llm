import type { app } from '@rttnd/llm-server'
import type { Manifest, Model, ModelSearchQuery, Provider } from '@rttnd/llm-shared'
import { treaty } from '@elysiajs/eden'
import { filterModels } from '@rttnd/llm-shared'

export * from '@rttnd/llm-shared'

export interface LLMClientConfig {
  /**
   * Base URL of the LLM Registry API
   * @default 'https://llm-registry.your-subdomain.workers.dev'
   */
  baseUrl: string

  /**
   * Enable in-memory caching of manifest data
   * @default true
   */
  enableCache?: boolean

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

export class LLMClient {
  public config: Required<LLMClientConfig>
  public cache: {
    manifest: Manifest | null
    version: string | null
    lastFetch: number
  }

  public refreshTimer: Timer | null = null
  private api: ReturnType<typeof treaty<typeof app>>

  constructor(config: LLMClientConfig) {
    this.config = {
      enableCache: true,
      autoRefreshInterval: 600000, // 10 minutes
      fetchOptions: {},
      headers: {},
      onUpdate: () => {},
      onError: () => {},
      ...config,
    }

    this.cache = {
      manifest: null,
      version: null,
      lastFetch: 0,
    }

    // Initialize Eden Treaty client
    this.api = treaty<typeof app>(this.config.baseUrl, {
      fetch: this.config.fetchOptions,
      headers: typeof this.config.headers === 'function'
        ? this.config.headers()
        : this.config.headers,
    })

    // Start auto-refresh if enabled
    if (this.config.autoRefreshInterval > 0)
      this.startAutoRefresh()
  }

  /**
   * Get the complete manifest with all providers and models
   */
  async getManifest(options?: { forceRefresh?: boolean }): Promise<LLMClientResponse<Manifest>> {
    try {
      // Return cached data if available and not forcing refresh
      if (this.config.enableCache && this.cache.manifest && !options?.forceRefresh) {
        return {
          data: this.cache.manifest,
          error: null,
          cached: true,
        }
      }

      // Fetch from API
      const { data, error, status } = await this.api.v1.manifest.get()

      if (error || !data) {
        const err = new Error(`Failed to fetch manifest: ${status}`)
        this.config.onError(err)
        return { data: null, error: err, cached: false }
      }

      // Update cache
      if (this.config.enableCache) {
        this.cache.manifest = data
        this.cache.version = data.version
        this.cache.lastFetch = Date.now()
        this.config.onUpdate(data)
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
   * Get all providers
   */
  async getProviders(options?: { forceRefresh?: boolean }): Promise<LLMClientResponse<Provider[]>> {
    try {
      // Try to get from cached manifest first
      if (this.config.enableCache && this.cache.manifest && !options?.forceRefresh) {
        return {
          data: this.cache.manifest.providers,
          error: null,
          cached: true,
        }
      }

      // Fetch from API
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
    try {
      // Try to get from cached manifest first
      if (this.config.enableCache && this.cache.manifest && !options?.forceRefresh) {
        const models = this.cache.manifest.models.filter(m => m.provider === providerId)
        return {
          data: models,
          error: null,
          cached: true,
        }
      }

      // Fetch from API
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
    try {
      const { data, error } = await this.api.v1.version.get()

      if (error || !data)
        return false

      // Check if version has changed
      if (this.cache.version && data.version !== this.cache.version) {
        await this.getManifest({ forceRefresh: true })
        return true
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
    try {
      const { data, error, status } = await this.api.v1.version.get()

      if (error || !data) {
        const err = new Error(`Failed to fetch version: ${status}`)
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

    const cachedManifest = this.config.enableCache && !options?.forceRefresh
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
    this.cache.lastFetch = 0
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
  }
}

/**
 * Create a new LLM client instance
 */
export function createClient(config: LLMClientConfig): LLMClient {
  return new LLMClient(config)
}
