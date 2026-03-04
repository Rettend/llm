import type { Model } from '../src/types'
import { describe, expect, it } from 'bun:test'
import { getModelRegistry } from '../src/registry'
import { canonicalizeModels, resolveReasoningProfile, resolveReasoningSelection } from '../src/reasoning'

function makeModel(overrides: Partial<Model>): Model {
  return {
    id: overrides.id ?? 'model-id',
    value: overrides.value ?? 'model-value',
    provider: overrides.provider ?? 'provider',
    name: overrides.name ?? 'Model Name',
    ...overrides,
  }
}

describe('resolveReasoningSelection', () => {
  it('falls back to default model value without reasoning control', () => {
    const result = resolveReasoningSelection(makeModel({ value: 'gpt-4.1' }))
    expect(result).toEqual({ id: 'default', model: 'gpt-4.1' })
  })

  it('uses default reasoning option when no option id is provided', () => {
    const model = makeModel({
      value: 'kimi-k2-5',
      reasoningControl: {
        default: 'default',
        options: [
          { id: 'default', model: 'kimi-k2-5-non-reasoning' },
          { id: 'thinking', model: 'kimi-k2-5' },
        ],
      },
    })

    const result = resolveReasoningSelection(model)
    expect(result).toEqual({ id: 'default', model: 'kimi-k2-5-non-reasoning' })
  })

  it('resolves selected effort option when provided', () => {
    const model = makeModel({
      value: 'gpt-5-3-codex',
      reasoningControl: {
        default: 'default',
        options: [
          { id: 'default', model: 'gpt-5-3-codex' },
          { id: 'high', model: 'gpt-5-3-codex', effort: 'high' },
        ],
      },
    })

    const result = resolveReasoningSelection(model, 'high')
    expect(result).toEqual({ id: 'high', model: 'gpt-5-3-codex', effort: 'high' })
  })

  it('falls back to default when selected option does not exist', () => {
    const model = makeModel({
      value: 'gpt-5-3-codex',
      reasoningControl: {
        default: 'default',
        options: [
          { id: 'default', model: 'gpt-5-3-codex' },
          { id: 'low', model: 'gpt-5-3-codex', effort: 'low' },
        ],
      },
    })

    const result = resolveReasoningSelection(model, 'xhigh')
    expect(result).toEqual({ id: 'default', model: 'gpt-5-3-codex' })
  })
})

describe('registry reasoning metadata', () => {
  it('attaches shared reasoning control to sibling variants', () => {
    const model = getModelRegistry('kimi', 'kimi-k2-5-non-reasoning')
    expect(model?.reasoningControl).toEqual({
      default: 'default',
      options: [
        { id: 'default', model: 'kimi-k2-5-non-reasoning' },
        { id: 'thinking', model: 'kimi-k2-5' },
      ],
    })
  })

  it('maps effort options to effort-specific model variants when available', () => {
    const model = getModelRegistry('aws', 'nova-2-0-pro')
    expect(model?.reasoningControl?.options).toEqual([
      { id: 'default', model: 'nova-2-0-pro' },
      { id: 'low', model: 'nova-2-0-pro-reasoning-low', effort: 'low' },
      { id: 'medium', model: 'nova-2-0-pro-reasoning-medium', effort: 'medium' },
      { id: 'high', model: 'nova-2-0-pro', effort: 'high' },
    ])
  })
})

describe('canonicalizeModels', () => {
  it('collapses reasoning variants into one canonical model', () => {
    const control = {
      default: 'default' as const,
      options: [
        { id: 'default' as const, model: 'grok-4-fast-non-reasoning' },
        { id: 'thinking' as const, model: 'grok-4-fast-reasoning' },
      ],
    }

    const models = [
      makeModel({
        id: 'a',
        provider: 'xai',
        value: 'grok-4-fast-non-reasoning',
        name: 'Grok 4 Fast (Non-reasoning)',
        alias: 'Grok 4 Fast',
        iq: 3,
        speed: 5,
        reasoningControl: control,
      }),
      makeModel({
        id: 'b',
        provider: 'xai',
        value: 'grok-4-fast-reasoning',
        name: 'Grok 4 Fast (Reasoning)',
        alias: 'Grok 4 Fast',
        iq: 4,
        speed: 3,
        reasoningControl: control,
      }),
    ]

    const canonical = canonicalizeModels(models)
    expect(canonical).toHaveLength(1)
    expect(canonical[0]?.name).toBe('Grok 4 Fast')
    expect(canonical[0]?.value).toBe('grok-4-fast')
    expect(canonical[0]?.reasoningControl?.options).toEqual([
      { id: 'default', model: 'grok-4-fast-non-reasoning' },
      { id: 'thinking', model: 'grok-4-fast-reasoning', iq: 4, speed: 3 },
    ])

    const thinking = resolveReasoningProfile(canonical[0]!, 'thinking')
    expect(thinking).toEqual({
      id: 'thinking',
      model: 'grok-4-fast-reasoning',
      effort: undefined,
      iq: 4,
      speed: 3,
    })
  })

  it('falls back to canonical default iq/speed when selected option has no override score', () => {
    const model = makeModel({
      value: 'gpt-5',
      iq: 4,
      speed: 5,
      reasoningControl: {
        default: 'default',
        options: [
          { id: 'default', model: 'gpt-5-non-reasoning' },
          { id: 'high', model: 'gpt-5', effort: 'high' },
        ],
      },
    })

    expect(resolveReasoningProfile(model, 'high')).toEqual({
      id: 'high',
      model: 'gpt-5',
      effort: 'high',
      iq: 4,
      speed: 5,
    })
  })
})
