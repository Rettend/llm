import type { Model } from '../src/types'
import { describe, expect, it } from 'bun:test'
import { filterModels } from '../src/search'

function makeModel(overrides: Partial<Model>): Model {
  return {
    id: overrides.id ?? 'model-id',
    value: overrides.value ?? 'model-value',
    provider: overrides.provider ?? 'provider',
    name: overrides.name ?? 'Model Name',
    ...overrides,
  }
}

describe('filterModels', () => {
  it('matches all required capabilities when array is provided', () => {
    const models = [
      makeModel({ id: 'a', capabilities: { text: true, json: true } }),
      makeModel({ id: 'b', capabilities: { text: true } }),
    ]

    const result = filterModels(models, { capability: ['text', 'json'] })
    expect(result.map(model => model.id)).toEqual(['a'])
  })

  it('filters by model status', () => {
    const models = [
      makeModel({ id: 'active', status: 'active' }),
      makeModel({ id: 'beta', status: 'beta' }),
    ]

    const result = filterModels(models, { status: 'active' })
    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe('active')
  })

  it('filters by release date range (string inputs)', () => {
    const models = [
      makeModel({ id: 'old', releaseDate: '2023-01-01' }),
      makeModel({ id: 'middle', releaseDate: '2024-01-01' }),
      makeModel({ id: 'new', releaseDate: '2025-01-01' }),
    ]

    const result = filterModels(models, {
      releaseDateFrom: '2023-12-31',
      releaseDateTo: '2024-12-31',
    })

    expect(result.map(model => model.id)).toEqual(['middle'])
  })

  it('ignores models without release dates when range is required', () => {
    const models = [
      makeModel({ id: 'dated', releaseDate: '2024-05-01' }),
      makeModel({ id: 'undated', releaseDate: undefined }),
    ]

    const result = filterModels(models, {
      releaseDateFrom: new Date('2024-01-01'),
      releaseDateTo: new Date('2024-12-31'),
    })

    expect(result.map(model => model.id)).toEqual(['dated'])
  })

  it('filters by minimum context window', () => {
    const models = [
      makeModel({ id: 'small', metrics: { contextWindow: 4000 } }),
      makeModel({ id: 'large', metrics: { contextWindow: 16000 } }),
    ]

    const result = filterModels(models, { minContextWindow: 8000 })
    expect(result.map(model => model.id)).toEqual(['large'])
  })

  it('filters by config mode', () => {
    const models = [
      makeModel({ id: 'auto', config: { mode: 'auto' } }),
      makeModel({ id: 'json', config: { mode: 'json' } }),
    ]

    const result = filterModels(models, { mode: 'json' })
    expect(result.map(model => model.id)).toEqual(['json'])
  })
})
