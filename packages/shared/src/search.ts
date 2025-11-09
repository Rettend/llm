import type { Model } from './types'

export interface ModelSearchQuery {
  name?: string
  provider?: string
  capability?: keyof NonNullable<Model['capabilities']>
  minIq?: number
  minSpeed?: number
}

/**
 * Filter models using shared search rules so client and server stay aligned.
 */
export function filterModels(models: Model[], query: ModelSearchQuery): Model[] {
  let filtered = models

  if (query.name && query.name.trim().length > 0) {
    const searchTerm = query.name.trim().toLowerCase()
    filtered = filtered.filter(model =>
      model.name.toLowerCase().includes(searchTerm)
      || model.value.toLowerCase().includes(searchTerm)
      || model.alias?.toLowerCase().includes(searchTerm),
    )
  }

  if (query.provider)
    filtered = filtered.filter(model => model.provider === query.provider)

  if (query.capability) {
    const capabilityKey = query.capability
    filtered = filtered.filter(model => Boolean(model.capabilities?.[capabilityKey]))
  }

  if (query.minIq !== undefined)
    filtered = filtered.filter(model => (model.iq ?? 0) >= query.minIq!)

  if (query.minSpeed !== undefined)
    filtered = filtered.filter(model => (model.speed ?? 0) >= query.minSpeed!)

  return filtered
}
