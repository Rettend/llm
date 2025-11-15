import type { Model, Provider } from './types'

export interface ProviderOverride {
  /**
   * Provider identifier (e.g. "groq", "cerebras", "azure")
   */
  value: string

  /**
   * Optional display name override
   */
  name?: string

  /**
   * Optional API key placeholder (e.g. "sk-...")
   */
  keyPlaceholder?: string

  /**
   * Optional website URL for obtaining API keys
   */
  website?: string

  /**
   * Optional status override
   */
  status?: Provider['status']
}

export interface ModelOverride {
  /**
   * Target provider id for this model (e.g. "groq", "cerebras", "azure")
   */
  provider: string

  /**
   * Target model value / identifier for AI SDK
   */
  value: string

  /**
   * Optionally inherit fields from another model.
   * Useful for inference providers that host an existing lab model.
   */
  inheritFrom?: {
    provider: string
    value: string
  }

  /**
   * Optional explicit id. If omitted, a stable synthetic id is generated.
   */
  id?: string

  /**
   * Optional metadata overrides
   */
  name?: string
  alias?: string
  capabilities?: Model['capabilities']
  iq?: Model['iq']
  speed?: Model['speed']
  metrics?: Partial<Model['metrics']>
  pricing?: Model['pricing']
  releaseDate?: Model['releaseDate']
  status?: Model['status']
  config?: Model['config']
}

export interface OverrideConfig {
  providers?: ProviderOverride[]
  models?: ModelOverride[]
}

function cloneModel(model: Model): Model {
  return {
    ...model,
    capabilities: model.capabilities ? { ...model.capabilities } : undefined,
    metrics: model.metrics ? { ...model.metrics } : undefined,
    pricing: model.pricing ? { ...model.pricing } : undefined,
    config: model.config ? { ...model.config } : undefined,
  }
}

/**
 * Apply provider and model overrides to a base manifest.
 *
 * - Provider overrides can update existing providers or add new ones.
 * - Model overrides can:
 *   - Update existing models (same provider/value)
 *   - Add new models
 *   - Clone an existing model via `inheritFrom` and attach it to another provider
 */
export function applyOverrides(
  baseProviders: Provider[],
  baseModels: Model[],
  overrides: OverrideConfig,
): { providers: Provider[], models: Model[] } {
  const providerMap = new Map<string, Provider>()

  for (const provider of baseProviders)
    providerMap.set(provider.value, { ...provider })

  for (const override of overrides.providers ?? []) {
    const existing = providerMap.get(override.value)

    if (existing) {
      providerMap.set(override.value, {
        ...existing,
        ...override,
      })
    }
    else {
      providerMap.set(override.value, {
        value: override.value,
        name: override.name ?? override.value,
        keyPlaceholder: override.keyPlaceholder,
        website: override.website,
        status: override.status ?? 'active',
      })
    }
  }

  const baseModelIndex = new Map<string, Model>()
  const modelsMap = new Map<string, Model>()

  for (const model of baseModels) {
    const key = `${model.provider}:${model.value}`
    baseModelIndex.set(key, model)
    modelsMap.set(key, cloneModel(model))
  }

  for (const override of overrides.models ?? []) {
    const key = `${override.provider}:${override.value}`
    const existing = modelsMap.get(key)
    const inheritedBase = override.inheritFrom
      ? baseModelIndex.get(`${override.inheritFrom.provider}:${override.inheritFrom.value}`)
      : undefined

    let model: Model

    if (override.inheritFrom && inheritedBase) {
      const base = cloneModel(inheritedBase)
      model = {
        ...base,
        provider: override.provider,
        value: override.value,
        id: override.id ?? `custom:${override.provider}:${override.value}`,
      }
    }
    else if (existing) {
      model = cloneModel(existing)
      if (override.id !== undefined)
        model.id = override.id
    }
    else {
      const name = override.name ?? override.value
      model = {
        id: override.id ?? `custom:${override.provider}:${override.value}`,
        provider: override.provider,
        value: override.value,
        name,
        alias: override.alias ?? name.split('(')[0]?.trim(),
      }
    }

    if (override.name !== undefined)
      model.name = override.name
    if (override.alias !== undefined)
      model.alias = override.alias
    if (override.capabilities !== undefined)
      model.capabilities = override.capabilities ? { ...override.capabilities } : undefined
    if (override.iq !== undefined)
      model.iq = override.iq
    if (override.speed !== undefined)
      model.speed = override.speed
    if (override.metrics !== undefined) {
      const current = model.metrics ?? {}
      model.metrics = override.metrics
        ? { ...current, ...override.metrics }
        : undefined
    }
    if (override.pricing !== undefined)
      model.pricing = override.pricing ? { ...override.pricing } : undefined
    if (override.releaseDate !== undefined)
      model.releaseDate = override.releaseDate
    if (override.status !== undefined)
      model.status = override.status
    if (override.config !== undefined)
      model.config = override.config ? { ...override.config } : undefined

    modelsMap.set(key, model)
  }

  return {
    providers: Array.from(providerMap.values()),
    models: Array.from(modelsMap.values()),
  }
}
