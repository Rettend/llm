import type { Manifest, Model, ModelSearchQuery, Provider } from '@rttnd/llm-shared'
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

  async getManifest(): Promise<Manifest | null> {
    return this.readManifest()
  }

  async getProviders(): Promise<Provider[]> {
    const manifest = await this.readManifest()
    return manifest?.providers ?? []
  }

  async getModels(): Promise<Model[]> {
    const manifest = await this.readManifest()
    return manifest?.models ?? []
  }

  async getProviderModels(provider: string): Promise<Model[]> {
    const models = await this.getModels()
    if (!models.length)
      return []

    return models.filter(model => model.provider === provider)
  }

  async getModel(provider: string, value: string): Promise<Model | null> {
    const models = await this.getModels()
    if (!models.length)
      return null

    return models.find(model => model.provider === provider && model.value === value) ?? null
  }

  async searchModels(query: ModelSearchQuery): Promise<Model[]> {
    const models = await this.getModels()
    if (!models.length)
      return []

    return filterModels(models, query)
  }

  private async readManifest(): Promise<Manifest | null> {
    const stored = await this.kv.get(this.manifestKey, 'text')
    if (!stored)
      return null

    try {
      return JSON.parse(stored) as Manifest
    }
    catch {
      return null
    }
  }
}

export function createKVRegistry(options: KVRegistryOptions): KVRegistry {
  return new KVRegistry(options)
}
