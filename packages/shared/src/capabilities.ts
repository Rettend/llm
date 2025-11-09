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
  'openai': {
    'gpt-5-codex': {
      contextWindow: 400000,
      capabilities: _(text, reasoning, toolUse, json),
    },
    'gpt-5': {
      contextWindow: 400000,
      capabilities: _(text, vision, reasoning, toolUse, json),
    },
    'gpt-5-medium': {
      contextWindow: 400000,
      capabilities: _(text, vision, reasoning, toolUse, json),
    },
    'o3': {
      contextWindow: 200000,
      capabilities: _(text, reasoning, toolUse, json),
    },
    'gpt-5-mini': {
      contextWindow: 400000,
      capabilities: _(text, vision, toolUse, json),
    },
    'gpt-5-low': {
      contextWindow: 400000,
      capabilities: _(text, vision, reasoning, toolUse, json),
    },
    'gpt-5-mini-medium': {
      contextWindow: 400000,
      capabilities: _(text, vision, toolUse, json),
    },
    'gpt-oss-120b': {
      contextWindow: 131000,
      capabilities: _(text, toolUse, json),
    },
    'gpt-oss-20b': {
      contextWindow: 131000,
      capabilities: _(text, toolUse, json),
    },
    'gpt-5-nano': {
      contextWindow: 400000,
      capabilities: _(text, toolUse, json),
    },
    'gpt-5-nano-medium': {
      contextWindow: 400000,
      capabilities: _(text, toolUse, json),
    },
    'gpt-oss-120b-low': {
      contextWindow: 131000,
      capabilities: _(text, toolUse, json),
    },
    'gpt-oss-20b-low': {
      contextWindow: 131000,
      capabilities: _(text, toolUse, json),
    },
    'gpt-5-minimal': {
      contextWindow: 400000,
      capabilities: _(text, toolUse, json),
    },
    'gpt-5-chatgpt': {
      contextWindow: 128000,
      capabilities: _(text, vision, toolUse, json),
    },
    'gpt-5-mini-minimal': {
      contextWindow: 400000,
      capabilities: _(text, toolUse, json),
    },
    'gpt-5-nano-minimal': {
      contextWindow: 400000,
      capabilities: _(text, toolUse, json),
    },
  },

  'moonshotai': {
    'kimi-k2-thinking': {
      contextWindow: 256000,
      capabilities: _(text, reasoning, toolUse, json),
    },
    'kimi-k2-0905': {
      contextWindow: 256000,
      capabilities: _(text, reasoning, toolUse, json),
    },
  },

  'xai': {
    'grok-4': {
      contextWindow: 256000,
      capabilities: _(text, vision, reasoning, toolUse, json),
    },
    'grok-4-fast': {
      contextWindow: 2000000,
      capabilities: _(text, vision, reasoning, toolUse, json),
    },
    'grok-3-mini-reasoning': {
      contextWindow: 1000000,
      capabilities: _(text, reasoning, toolUse, json),
    },
    'grok-code-fast-1': {
      contextWindow: 256000,
      capabilities: _(text, toolUse, json),
    },
  },

  'anthropic': {
    'claude-4-5-sonnet': {
      contextWindow: 1000000,
      capabilities: _(text, vision, reasoning, toolUse, json),
    },
    'claude-4-1-opus': {
      contextWindow: 200000,
      capabilities: _(text, vision, reasoning, toolUse, json),
    },
    'claude-4-5-haiku': {
      contextWindow: 200000,
      capabilities: _(text, vision, toolUse, json),
    },
  },

  'google': {
    'gemini-2-5-pro': {
      contextWindow: 1000000,
      capabilities: _(text, vision, reasoning, toolUse, json, audio),
    },
    'gemini-2-5-flash': {
      contextWindow: 1000000,
      capabilities: _(text, vision, toolUse, json, audio),
    },
    'gemini-2-5-flash-lite': {
      contextWindow: 1000000,
      capabilities: _(text, vision, toolUse, json),
    },
    'gemma-3-27b': {
      contextWindow: 128000,
      capabilities: _(text, toolUse, json),
    },
    'gemma-3-12b': {
      contextWindow: 128000,
      capabilities: _(text, toolUse, json),
    },
    'gemma-3n-e4b': {
      contextWindow: 32000,
      capabilities: _(text),
    },
    'gemma-3-4b': {
      contextWindow: 128000,
      capabilities: _(text, toolUse, json),
    },
    'gemma-3n-e2b': {
      contextWindow: 32000,
      capabilities: _(text),
    },
    'gemma-3-1b': {
      contextWindow: 32000,
      capabilities: _(text),
    },
    'gemma-3-270m': {
      contextWindow: 32000,
      capabilities: _(text),
    },
  },

  'minimax': {
    'minimax-m2': {
      contextWindow: 205000,
      capabilities: _(text, reasoning, toolUse, json),
    },
    'minimax-text-01': {
      contextWindow: 4000000,
      capabilities: _(text, toolUse, json),
    },
  },

  'deepseek': {
    'deepseek-v3-1-terminus': {
      contextWindow: 128000,
      capabilities: _(text, reasoning, toolUse, json),
    },
    'deepseek-v3-2-exp': {
      contextWindow: 128000,
      capabilities: _(text, reasoning, toolUse, json),
    },
    'deepseek-r1-0528': {
      contextWindow: 128000,
      capabilities: _(text, reasoning, toolUse, json),
    },
    'deepseek-r1-0528-qwen3-8b': {
      contextWindow: 33000,
      capabilities: _(text, reasoning, toolUse, json),
    },
    'deepseek-r1-distill-llama-70b': {
      contextWindow: 128000,
      capabilities: _(text, reasoning, toolUse, json),
    },
  },

  'alibaba': {
    'qwen3-235b-a22b-2507': {
      contextWindow: 256000,
      capabilities: _(text, reasoning, toolUse, json),
    },
    'qwen3-max': {
      contextWindow: 262000,
      capabilities: _(text, reasoning, toolUse, json),
    },
    'qwen3-vl-235b-a22b': {
      contextWindow: 262000,
      capabilities: _(text, vision, reasoning, toolUse, json),
    },
    'qwen3-next-80b-a3b': {
      contextWindow: 262000,
      capabilities: _(text, reasoning, toolUse, json),
    },
    'qwen3-vl-32b': {
      contextWindow: 256000,
      capabilities: _(text, vision, toolUse, json),
    },
    'qwen3-30b-a3b-2507': {
      contextWindow: 262000,
      capabilities: _(text, reasoning, toolUse, json),
    },
    'qwen3-235b-2507': {
      contextWindow: 256000,
      capabilities: _(text, reasoning, toolUse, json),
    },
    'qwen3-vl-30b-a3b': {
      contextWindow: 256000,
      capabilities: _(text, vision, toolUse, json),
    },
    'qwen3-4b-2507': {
      contextWindow: 262000,
      capabilities: _(text, toolUse, json),
    },
    'qwen3-coder-480b': {
      contextWindow: 262000,
      capabilities: _(text, reasoning, toolUse, json),
    },
    'qwen3-omni-30b-a3b': {
      contextWindow: 66000,
      capabilities: _(text, audio, toolUse, json),
    },
    'qwen3-coder-30b-a3b': {
      contextWindow: 262000,
      capabilities: _(text, toolUse, json),
    },
    'qwen3-vl-8b': {
      contextWindow: 256000,
      capabilities: _(text, vision, toolUse, json),
    },
    'qwen3-vl-4b': {
      contextWindow: 256000,
      capabilities: _(text, vision, toolUse, json),
    },
  },

  'z-ai': {
    'glm-4-6': {
      contextWindow: 200000,
      capabilities: _(text, vision, reasoning, toolUse, json),
    },
    'glm-4-5-air': {
      contextWindow: 128000,
      capabilities: _(text, vision, toolUse, json),
    },
    'glm-4-5v': {
      contextWindow: 64000,
      capabilities: _(text, vision, toolUse, json),
    },
  },

  'mistral': {
    'magistral-medium-1-2': {
      contextWindow: 128000,
      capabilities: _(text, reasoning, toolUse, json),
    },
    'magistral-small-1-2': {
      contextWindow: 128000,
      capabilities: _(text, reasoning, toolUse, json),
    },
    'mistral-medium-3-1': {
      contextWindow: 128000,
      capabilities: _(text, reasoning, toolUse, json),
    },
    'mistral-small-3-2': {
      contextWindow: 128000,
      capabilities: _(text, toolUse, json),
    },
    'devstral-medium': {
      contextWindow: 256000,
      capabilities: _(text, toolUse, json),
    },
    'devstral-small': {
      contextWindow: 256000,
      capabilities: _(text, toolUse, json),
    },
    'codestral': {
      contextWindow: 256000,
      capabilities: _(text, toolUse, json),
    },
    'ministral-8b': {
      contextWindow: 128000,
      capabilities: _(text, toolUse, json),
    },
    'ministral-3b': {
      contextWindow: 128000,
      capabilities: _(text, toolUse, json),
    },
  },

  'bytedance_seed': {
    'seed-oss-36b-instruct': {
      contextWindow: 512000,
      capabilities: _(text, toolUse, json),
    },
  },

  'servicenow': {
    'apriel-v1-5-15b-thinker': {
      contextWindow: 128000,
      capabilities: _(text, reasoning, toolUse, json),
    },
  },

  'nvidia': {
    'llama-nemotron-super-49b-v1-5': {
      contextWindow: 128000,
      capabilities: _(text, reasoning, toolUse, json),
    },
    'llama-nemotron-ultra': {
      contextWindow: 128000,
      capabilities: _(text, reasoning, toolUse, json),
    },
    'nvidia-nemotron-nano-9b-v2': {
      contextWindow: 131000,
      capabilities: _(text, toolUse, json),
    },
    'llama-3-3-nemotron-super-49b': {
      contextWindow: 128000,
      capabilities: _(text, reasoning, toolUse, json),
    },
    'llama-3-1-nemotron-nano-4b-v1-1': {
      contextWindow: 128000,
      capabilities: _(text, toolUse, json),
    },
    'llama-3-1-nemotron-70b': {
      contextWindow: 128000,
      capabilities: _(text, toolUse, json),
    },
  },

  'inclusionai': {
    'ling-1t': {
      contextWindow: 128000,
      capabilities: _(text, reasoning, toolUse, json),
    },
    'ring-flash-2-0': {
      contextWindow: 128000,
      capabilities: _(text, toolUse, json),
    },
    'ling-flash-2-0': {
      contextWindow: 128000,
      capabilities: _(text, toolUse, json),
    },
    'ling-mini-2-0': {
      contextWindow: 131000,
      capabilities: _(text, toolUse, json),
    },
  },

  'lg': {
    'exaone-4-0-32b': {
      contextWindow: 131000,
      capabilities: _(text, toolUse, json),
    },
    'exaone-4-0-1-2b': {
      contextWindow: 64000,
      capabilities: _(text),
    },
  },

  'nous-research': {
    'hermes-4-405b': {
      contextWindow: 128000,
      capabilities: _(text, reasoning, toolUse, json),
    },
    'hermes-4-70b': {
      contextWindow: 128000,
      capabilities: _(text, reasoning, toolUse, json),
    },
    'deephermes-3-mistral-24b': {
      contextWindow: 32000,
      capabilities: _(text, toolUse, json),
    },
    'deephermes-3-llama-3-1-8b': {
      contextWindow: 128000,
      capabilities: _(text, toolUse, json),
    },
  },

  'upstage': {
    'solar-pro-2': {
      contextWindow: 66000,
      capabilities: _(text, reasoning, toolUse, json),
    },
  },

  'meta': {
    'llama-4-maverick': {
      contextWindow: 1000000,
      capabilities: _(text, reasoning, toolUse, json),
    },
    'llama-4-scout': {
      contextWindow: 10000000,
      capabilities: _(text, reasoning, toolUse, json),
    },
    'llama-3-1-405b': {
      contextWindow: 128000,
      capabilities: _(text, toolUse, json),
    },
    'llama-3-3-70b': {
      contextWindow: 128000,
      capabilities: _(text, toolUse, json),
    },
    'llama-3-2-90b-vision': {
      contextWindow: 128000,
      capabilities: _(text, vision, toolUse, json),
    },
    'llama-3-2-11b-vision': {
      contextWindow: 128000,
      capabilities: _(text, vision, toolUse, json),
    },
  },

  'baidu': {
    'ernie-4-5-300b-a47b': {
      contextWindow: 131000,
      capabilities: _(text, reasoning, toolUse, json),
    },
  },

  'aws': {
    'nova-premier': {
      contextWindow: 1000000,
      capabilities: _(text, vision, reasoning, toolUse, json),
    },
    'nova-pro': {
      contextWindow: 300000,
      capabilities: _(text, vision, toolUse, json),
    },
    'nova-lite': {
      contextWindow: 300000,
      capabilities: _(text, vision, toolUse, json),
    },
    'nova-micro': {
      contextWindow: 130000,
      capabilities: _(text, toolUse, json),
    },
  },

  'cohere': {
    'command-a': {
      contextWindow: 256000,
      capabilities: _(text, reasoning, toolUse, json),
    },
    'aya-expanse-32b': {
      contextWindow: 128000,
      capabilities: _(text, toolUse, json),
    },
    'aya-expanse-8b': {
      contextWindow: 8000,
      capabilities: _(text),
    },
  },

  'reka-ai': {
    'reka-flash-3': {
      contextWindow: 128000,
      capabilities: _(text, vision, toolUse, json),
    },
  },

  'ibm': {
    'granite-4-0-h-small': {
      contextWindow: 128000,
      capabilities: _(text, toolUse, json),
    },
    'granite-4-0-micro': {
      contextWindow: 128000,
      capabilities: _(text, toolUse, json),
    },
    'granite-4-0-h-1b': {
      contextWindow: 128000,
      capabilities: _(text, toolUse, json),
    },
    'granite-4-0-1b': {
      contextWindow: 128000,
      capabilities: _(text),
    },
    'granite-4-0-h-350m': {
      contextWindow: 33000,
      capabilities: _(text),
    },
    'granite-4-0-350m': {
      contextWindow: 33000,
      capabilities: _(text),
    },
  },

  'azure': {
    'phi-4': {
      contextWindow: 16000,
      capabilities: _(text, reasoning, toolUse, json),
    },
    'phi-4-mini': {
      contextWindow: 128000,
      capabilities: _(text, toolUse, json),
    },
    'phi-4-multimodal': {
      contextWindow: 128000,
      capabilities: _(text, vision, toolUse, json),
    },
  },

  'ai21-labs': {
    'jamba-reasoning-3b': {
      contextWindow: 262000,
      capabilities: _(text, reasoning, toolUse, json),
    },
    'jamba-1-7-large': {
      contextWindow: 256000,
      capabilities: _(text, toolUse, json),
    },
    'jamba-1-7-mini': {
      contextWindow: 258000,
      capabilities: _(text, toolUse, json),
    },
  },

  'perplexity': {
    'r1-1776': {
      contextWindow: 128000,
      capabilities: _(text, reasoning, toolUse, json),
    },
  },

  'liquidai': {
    'lfm2-8b-a1b': {
      contextWindow: 33000,
      capabilities: _(text, toolUse, json),
    },
    'lfm2-2-6b': {
      contextWindow: 33000,
      capabilities: _(text, toolUse, json),
    },
    'lfm2-1-2b': {
      contextWindow: 33000,
      capabilities: _(text),
    },
  },
})

/**
 * Get capabilities for a specific model
 */
export function getModelCapabilities(provider: string, modelValue: string): ModelCapabilities | undefined {
  const group = (MODEL_CAPABILITIES as CapabilitiesMap)[provider]
  return group?.[modelValue]
}
