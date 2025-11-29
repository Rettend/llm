import type { Model } from './types'

type CapabilityKey = keyof NonNullable<Model['capabilities']>
type ModelStatus = Model['status']
type ModelMode = NonNullable<NonNullable<Model['config']>['mode']>

export interface ModelSearchQuery {
  name?: string | string[]
  provider?: string | string[]
  capability?: CapabilityKey | CapabilityKey[]
  status?: ModelStatus | ModelStatus[]
  releaseDateFrom?: string | Date
  releaseDateTo?: string | Date
  minIq?: number
  minSpeed?: number
  minContextWindow?: number
  mode?: ModelMode
}

/**
 * Filter models using shared search rules so client and server stay aligned.
 */
export function filterModels(models: Model[], query: ModelSearchQuery): Model[] {
  let filtered = models

  if (query.name) {
    const nameFilters = (Array.isArray(query.name) ? query.name : [query.name])
      .map(n => n.trim().toLowerCase())
      .filter(n => n.length > 0)
    if (nameFilters.length > 0) {
      filtered = filtered.filter(model =>
        nameFilters.some(searchTerm =>
          model.name.toLowerCase().includes(searchTerm)
          || model.value.toLowerCase().includes(searchTerm)
          || model.alias?.toLowerCase().includes(searchTerm),
        ),
      )
    }
  }

  if (query.provider) {
    const providerFilters = Array.isArray(query.provider) ? query.provider : [query.provider]
    filtered = filtered.filter(model => providerFilters.includes(model.provider))
  }

  if (query.capability) {
    const capabilityFilters = Array.isArray(query.capability) ? query.capability : [query.capability]
    filtered = filtered.filter(model => capabilityFilters.every(capabilityKey => Boolean(model.capabilities?.[capabilityKey])))
  }

  if (query.status) {
    const statusFilters = Array.isArray(query.status) ? query.status : [query.status]
    filtered = filtered.filter(model => Boolean(model.status && statusFilters.includes(model.status)))
  }

  const releaseFrom = normalizeDate(query.releaseDateFrom)
  const releaseTo = normalizeDate(query.releaseDateTo)
  if (releaseFrom || releaseTo) {
    filtered = filtered.filter((model) => {
      const modelDate = normalizeDate(model.releaseDate)
      if (!modelDate)
        return false

      if (releaseFrom && modelDate < releaseFrom)
        return false
      if (releaseTo && modelDate > releaseTo)
        return false
      return true
    })
  }

  if (query.minIq !== undefined)
    filtered = filtered.filter(model => (model.iq ?? 0) >= query.minIq!)

  if (query.minSpeed !== undefined)
    filtered = filtered.filter(model => (model.speed ?? 0) >= query.minSpeed!)

  if (query.minContextWindow !== undefined)
    filtered = filtered.filter(model => (model.metrics?.contextWindow ?? 0) >= query.minContextWindow!)

  if (query.mode)
    filtered = filtered.filter(model => model.config?.mode === query.mode)

  return filtered
}

function normalizeDate(value?: string | Date | null): Date | undefined {
  if (!value)
    return undefined

  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}
