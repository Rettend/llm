import type { Model } from '../src/types'
import { describe, expect, it } from 'bun:test'
import { getModelRegistry } from '../src/registry'
import { resolveReasoningSelection } from '../src/reasoning'

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
})
