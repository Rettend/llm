import type { Manifest, Model, ModelSearchQuery, Provider } from '@rttnd/llm-shared'
import type { LLMClientResponse } from './response'
import { filterModels } from '@rttnd/llm-shared'

export interface KVRegistryBinding {
  get: (key: string, type: 'text') => Promise<string | null>
}

export interface KVRegistryOptions {
  kv: KVRegistryBinding
  manifestKey?: string
}

export class KVRegistry {
  private readonly kv: KVRegistryBinding
  private readonly manifestKey: string

  constructor(options: KVRegistryOptions) {
    if (!options?.kv)
      throw new Error('KV binding is required')

    this.kv = options.kv
    this.manifestKey = options.manifestKey ?? 'manifest'
  }

  async getManifest(): Promise<LLMClientResponse<Manifest>> {
    return this.createResponse(() => this.readManifestOrThrow())
  }

  async getProviders(): Promise<LLMClientResponse<Provider[]>> {
    return this.withManifest(manifest => manifest.providers)
  }

  async getModels(): Promise<LLMClientResponse<Model[]>> {
    return this.withManifest(manifest => manifest.models)
  }

  async getProviderModels(provider: string): Promise<LLMClientResponse<Model[]>> {
    return this.withManifest(manifest => manifest.models.filter(model => model.provider === provider))
  }

  async getModel(provider: string, value: string): Promise<LLMClientResponse<Model>> {
    return this.withManifest((manifest) => {
      const model = manifest.models.find(item => item.provider === provider && item.value === value)
      if (!model)
        throw new Error(`Model ${value} not found for provider ${provider}`)

      return model
    })
  }

  async searchModels(query: ModelSearchQuery): Promise<LLMClientResponse<Model[]>> {
    return this.withManifest(manifest => filterModels(manifest.models, query))
  }

  private async withManifest<T>(project: (manifest: Manifest) => T | Promise<T>): Promise<LLMClientResponse<T>> {
    return this.createResponse(async () => {
      const manifest = await this.readManifestOrThrow()
      return project(manifest)
    })
  }

  private async createResponse<T>(execute: () => Promise<T>): Promise<LLMClientResponse<T>> {
    try {
      const data = await execute()
      return { data, error: null, cached: true }
    }
    catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error(String(error)),
        cached: false,
      }
    }
  }

  private async readManifestOrThrow(): Promise<Manifest> {
    const stored = await this.kv.get(this.manifestKey, 'text')
    if (!stored)
      throw new Error(`Manifest not found in KV (key: ${this.manifestKey})`)

    try {
      return JSON.parse(stored) as Manifest
    }
    catch (error) {
      const parseError = error instanceof Error ? error : new Error(String(error))
      throw new Error('Manifest in KV is not valid JSON', { cause: parseError })
    }
  }
}

export function createKVRegistry(options: KVRegistryOptions): KVRegistry {
  return new KVRegistry(options)
}
