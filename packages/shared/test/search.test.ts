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
  describe('name filter', () => {
    it('filters by single name (partial match)', () => {
      const models = [
        makeModel({ id: 'gpt', name: 'GPT-4o' }),
        makeModel({ id: 'claude', name: 'Claude 3.5' }),
      ]

      const result = filterModels(models, { name: 'gpt' })
      expect(result.map(model => model.id)).toEqual(['gpt'])
    })

    it('matches name against value field', () => {
      const models = [
        makeModel({ id: 'a', name: 'Model A', value: 'gpt-4o' }),
        makeModel({ id: 'b', name: 'Model B', value: 'claude-3' }),
      ]

      const result = filterModels(models, { name: 'gpt' })
      expect(result.map(model => model.id)).toEqual(['a'])
    })

    it('matches name against alias field', () => {
      const models = [
        makeModel({ id: 'a', name: 'Model A', alias: 'smart-model' }),
        makeModel({ id: 'b', name: 'Model B', alias: 'fast-model' }),
      ]

      const result = filterModels(models, { name: 'smart' })
      expect(result.map(model => model.id)).toEqual(['a'])
    })

    it('filters by multiple names (OR logic)', () => {
      const models = [
        makeModel({ id: 'gpt', name: 'GPT-4o' }),
        makeModel({ id: 'claude', name: 'Claude 3.5' }),
        makeModel({ id: 'gemini', name: 'Gemini Pro' }),
      ]

      const result = filterModels(models, { name: ['gpt', 'claude'] })
      expect(result.map(model => model.id)).toEqual(['gpt', 'claude'])
    })

    it('ignores empty strings in name array', () => {
      const models = [
        makeModel({ id: 'gpt', name: 'GPT-4o' }),
        makeModel({ id: 'claude', name: 'Claude 3.5' }),
      ]

      const result = filterModels(models, { name: ['gpt', '', '  '] })
      expect(result.map(model => model.id)).toEqual(['gpt'])
    })
  })

  describe('provider filter', () => {
    it('filters by single provider', () => {
      const models = [
        makeModel({ id: 'a', provider: 'openai' }),
        makeModel({ id: 'b', provider: 'anthropic' }),
      ]

      const result = filterModels(models, { provider: 'openai' })
      expect(result.map(model => model.id)).toEqual(['a'])
    })

    it('filters by multiple providers (OR logic)', () => {
      const models = [
        makeModel({ id: 'a', provider: 'openai' }),
        makeModel({ id: 'b', provider: 'anthropic' }),
        makeModel({ id: 'c', provider: 'google' }),
      ]

      const result = filterModels(models, { provider: ['openai', 'anthropic'] })
      expect(result.map(model => model.id)).toEqual(['a', 'b'])
    })
  })

  describe('capability filter', () => {
    it('filters by single capability', () => {
      const models = [
        makeModel({ id: 'a', capabilities: { text: true } }),
        makeModel({ id: 'b', capabilities: { vision: true } }),
      ]

      const result = filterModels(models, { capability: 'text' })
      expect(result.map(model => model.id)).toEqual(['a'])
    })

    it('matches all required capabilities when array is provided (AND logic)', () => {
      const models = [
        makeModel({ id: 'a', capabilities: { text: true, json: true } }),
        makeModel({ id: 'b', capabilities: { text: true } }),
      ]

      const result = filterModels(models, { capability: ['text', 'json'] })
      expect(result.map(model => model.id)).toEqual(['a'])
    })
  })

  describe('status filter', () => {
    it('filters by single status', () => {
      const models = [
        makeModel({ id: 'latest', status: 'latest' }),
        makeModel({ id: 'preview', status: 'preview' }),
      ]

      const result = filterModels(models, { status: 'latest' })
      expect(result).toHaveLength(1)
      expect(result[0]?.id).toBe('latest')
    })

    it('filters by multiple statuses when array is provided (OR logic)', () => {
      const models = [
        makeModel({ id: 'latest', status: 'latest' }),
        makeModel({ id: 'preview', status: 'preview' }),
        makeModel({ id: 'all', status: 'all' }),
      ]

      const result = filterModels(models, { status: ['latest', 'preview'] })
      expect(result.map(model => model.id)).toEqual(['latest', 'preview'])
    })
  })

  describe('release date filter', () => {
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
  })

  describe('numeric filters', () => {
    it('filters by minimum IQ', () => {
      const models = [
        makeModel({ id: 'low', iq: 2 }),
        makeModel({ id: 'high', iq: 4 }),
      ]

      const result = filterModels(models, { minIq: 3 })
      expect(result.map(model => model.id)).toEqual(['high'])
    })

    it('filters by minimum speed', () => {
      const models = [
        makeModel({ id: 'slow', speed: 2 }),
        makeModel({ id: 'fast', speed: 4 }),
      ]

      const result = filterModels(models, { minSpeed: 3 })
      expect(result.map(model => model.id)).toEqual(['fast'])
    })

    it('filters by minimum context window', () => {
      const models = [
        makeModel({ id: 'small', metrics: { contextWindow: 4000 } }),
        makeModel({ id: 'large', metrics: { contextWindow: 16000 } }),
      ]

      const result = filterModels(models, { minContextWindow: 8000 })
      expect(result.map(model => model.id)).toEqual(['large'])
    })
  })

  describe('mode filter', () => {
    it('filters by config mode', () => {
      const models = [
        makeModel({ id: 'auto', config: { mode: 'auto' } }),
        makeModel({ id: 'json', config: { mode: 'json' } }),
      ]

      const result = filterModels(models, { mode: 'json' })
      expect(result.map(model => model.id)).toEqual(['json'])
    })
  })

  describe('combined filters', () => {
    it('applies multiple filters together', () => {
      const models = [
        makeModel({ id: 'a', provider: 'openai', capabilities: { text: true }, status: 'latest', iq: 4 }),
        makeModel({ id: 'b', provider: 'openai', capabilities: { text: true }, status: 'preview', iq: 3 }),
        makeModel({ id: 'c', provider: 'anthropic', capabilities: { text: true }, status: 'latest', iq: 5 }),
      ]

      const result = filterModels(models, {
        provider: 'openai',
        capability: 'text',
        status: 'latest',
        minIq: 3,
      })

      expect(result.map(model => model.id)).toEqual(['a'])
    })
  })
})
