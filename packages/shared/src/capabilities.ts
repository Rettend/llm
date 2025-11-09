export interface ModelCapabilities {
  contextWindow: number
  capabilities: {
    text: boolean
    vision?: boolean
    reasoning?: boolean
    toolUse?: boolean
    json?: boolean
    audio?: boolean
  }
}

type CapabilitiesMap = Record<string, Record<string, ModelCapabilities>>

export type CapabilityKey = 'text' | 'vision' | 'reasoning' | 'toolUse' | 'json' | 'audio'
type CapabilityFlags = { [K in CapabilityKey]?: boolean }
type CanonicalCapabilities = { text: boolean } & { [K in Exclude<CapabilityKey, 'text'>]?: boolean }

export const text: CapabilityKey = 'text'
export const vision: CapabilityKey = 'vision'
export const reasoning: CapabilityKey = 'reasoning'
export const toolUse: CapabilityKey = 'toolUse'
export const json: CapabilityKey = 'json'
export const audio: CapabilityKey = 'audio'

const ALL_CAP_KEYS: readonly CapabilityKey[] = [
  'text',
  'vision',
  'reasoning',
  'toolUse',
  'json',
  'audio',
] as const

function toFlags(input: readonly CapabilityKey[] | CapabilityFlags): CanonicalCapabilities {
  if (Array.isArray(input)) {
    const set = new Set(input)
    const out: CanonicalCapabilities = { text: set.has('text') }
    for (const key of ALL_CAP_KEYS) {
      if (key === 'text')
        continue
      out[key] = set.has(key)
    }
    return out
  }
  const out: CanonicalCapabilities = { text: Boolean((input as CapabilityFlags).text) }
  for (const key of ALL_CAP_KEYS) {
    if (key === 'text')
      continue
    out[key] = Boolean((input as CapabilityFlags)[key])
  }
  return out
}

function _(...keys: CapabilityKey[]): CapabilityFlags {
  return toFlags(keys)
}

interface FlexibleModelCapabilities {
  contextWindow: number
  capabilities: readonly CapabilityKey[] | CapabilityFlags
}

type FlexibleCapabilitiesMap = Record<string, Record<string, FlexibleModelCapabilities>>

function defineModelCapabilities(map: FlexibleCapabilitiesMap): CapabilitiesMap {
  const out: CapabilitiesMap = {}
  for (const provider of Object.keys(map)) {
    out[provider] = {}
    const models = map[provider]
    if (!models)
      continue
    for (const model of Object.keys(models)) {
      const def = models[model]
      if (!def)
        continue
      out[provider][model] = {
        contextWindow: def.contextWindow,
        capabilities: toFlags(def.capabilities),
      }
    }
  }
  return out
}

export const MODEL_CAPABILITIES = defineModelCapabilities({
  openai: {
    'gpt-5': {
      contextWindow: 128000,
      capabilities: _(text, vision, reasoning, toolUse, json),
    },
    'gpt-5-mini': {
      contextWindow: 128000,
      capabilities: _(text, vision, toolUse, json),
    },
    'gpt-oss-20b': {
      contextWindow: 64000,
      capabilities: _(text, toolUse, json),
    },
    'gpt-oss-120b': {
      contextWindow: 64000,
      capabilities: _(text, toolUse, json),
    },
    'gpt-5-codex': {
      contextWindow: 128000,
      capabilities: _(text, reasoning, toolUse, json),
    },
  },

  anthropic: {
    'claude-3-5-sonnet-20241022': {
      contextWindow: 200000,
      capabilities: _(text, vision, toolUse, json),
    },
  },

  // TODO: Populate remaining models from AA API
})

/**
 * Get capabilities for a specific model
 */
export function getModelCapabilities(provider: string, modelValue: string): ModelCapabilities | undefined {
  const group = (MODEL_CAPABILITIES as CapabilitiesMap)[provider]
  return group?.[modelValue]
}
