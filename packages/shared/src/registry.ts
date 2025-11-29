import type { Status } from './types'

export type ModelStatus = Status

export interface ModelRegistry {
  status: ModelStatus
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

type RegistryMap = Record<string, Record<string, ModelRegistry>>

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

interface FlexibleModelRegistry {
  status?: ModelStatus
  contextWindow: number
  capabilities: readonly CapabilityKey[] | CapabilityFlags
}

type FlexibleRegistryMap = Record<string, Record<string, FlexibleModelRegistry>>

function defineModelRegistry(map: FlexibleRegistryMap): RegistryMap {
  const out: RegistryMap = {}
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
        status: def.status ?? 'latest',
      }
    }
  }
  return out
}

export const MODEL_REGISTRY = defineModelRegistry({
  'openai': {
    'gpt-5-1': { contextWindow: 400_000, capabilities: _(text, vision, reasoning, toolUse, json) },
    'gpt-5-1-non-reasoning': { contextWindow: 400_000, capabilities: _(text, vision, reasoning, toolUse, json) },
    'gpt-5-codex': { contextWindow: 400_000, capabilities: _(text, vision, reasoning, toolUse, json) },
    'gpt-5-mini': { contextWindow: 400_000, capabilities: _(text, vision, reasoning, toolUse, json) },
    'gpt-5-mini-medium': { contextWindow: 400_000, capabilities: _(text, vision, reasoning, toolUse, json) },
    'gpt-oss-120b': { contextWindow: 131_000, capabilities: _(text, vision, reasoning, toolUse, json) },
    'gpt-oss-20b': { contextWindow: 131_000, capabilities: _(text, vision, reasoning, toolUse, json) },
    'gpt-5-nano': { contextWindow: 400_000, capabilities: _(text, vision, reasoning, toolUse, json) },
    'gpt-5-nano-medium': { contextWindow: 400_000, capabilities: _(text, vision, reasoning, toolUse, json) },
    'gpt-oss-120b-low': { contextWindow: 131_000, capabilities: _(text, vision, reasoning, toolUse, json) },
    'gpt-oss-20b-low': { contextWindow: 131_000, capabilities: _(text, vision, reasoning, toolUse, json) },
    'gpt-5-minimal': { contextWindow: 400_000, capabilities: _(text, vision, reasoning, toolUse, json) },
    'gpt-5-mini-minimal': { contextWindow: 400_000, capabilities: _(text, vision, reasoning, toolUse, json) },
    'gpt-5-nano-minimal': { contextWindow: 400_000, capabilities: _(text, vision, reasoning, toolUse, json) },
  },

  'moonshotai': {
    'kimi-k2-thinking': { contextWindow: 256_000, capabilities: _(text, reasoning, toolUse, json) },
    'kimi-k2-0905': { contextWindow: 256_000, capabilities: _(text, reasoning, toolUse, json) },
    'kimi-linear-48b-a3b-instruct': { contextWindow: 1_000_000, capabilities: _(text, toolUse, json) },
  },

  'xai': {
    'grok-4': { contextWindow: 256_000, capabilities: _(text, vision, reasoning, toolUse, json) },
    'grok-4-1-fast-reasoning': { contextWindow: 1_000_000, capabilities: _(text, vision, reasoning, toolUse, json) },
    'grok-4-1-fast': { contextWindow: 1_000_000, capabilities: _(text, vision, toolUse, json) },
    'grok-4-fast-reasoning': { contextWindow: 1_000_000, capabilities: _(text, vision, reasoning, toolUse, json) },
    'grok-4-fast': { contextWindow: 1_000_000, capabilities: _(text, vision, toolUse, json) },
    'grok-code-fast-1': { contextWindow: 256_000, capabilities: _(text, toolUse, json) },
  },

  'anthropic': {
    'claude-opus-4-5': { contextWindow: 200_000, capabilities: _(text, vision, toolUse, json) },
    'claude-opus-4-5-thinking': { contextWindow: 200_000, capabilities: _(text, vision, reasoning, toolUse, json) },
    'claude-4-5-sonnet': { contextWindow: 1_000_000, capabilities: _(text, vision, toolUse, json) },
    'claude-4-5-sonnet-thinking': { contextWindow: 1_000_000, capabilities: _(text, vision, reasoning, toolUse, json) },
    'claude-4-5-haiku': { contextWindow: 200_000, capabilities: _(text, vision, toolUse, json) },
    'claude-4-5-haiku-reasoning': { contextWindow: 200_000, capabilities: _(text, vision, reasoning, toolUse, json) },
  },

  'google': {
    'gemini-3-pro': { contextWindow: 1_048_576, capabilities: _(text, vision, reasoning, toolUse, json, audio) },
    'gemini-2-5-pro': { contextWindow: 1_048_576, capabilities: _(text, vision, reasoning, toolUse, json, audio) },
    'gemini-2-5-flash': { contextWindow: 1_048_576, capabilities: _(text, vision, reasoning, toolUse, json, audio) },
    'gemini-2-5-flash-lite': { contextWindow: 1_048_576, capabilities: _(text, vision, reasoning, toolUse, json) },
    'gemma-3-27b': { contextWindow: 128_000, capabilities: _(text, vision, toolUse, json) },
    'gemma-3-12b': { contextWindow: 128_000, capabilities: _(text, vision, toolUse, json) },
    'gemma-3n-e4b': { contextWindow: 32_000, capabilities: _(text, vision, audio) },
    'gemma-3-4b': { contextWindow: 128_000, capabilities: _(text, vision, toolUse, json) },
    'gemma-3n-e2b': { contextWindow: 32_000, capabilities: _(text, vision, audio) },
    'gemma-3-1b': { contextWindow: 32_000, capabilities: _(text, vision, toolUse, json) },
    'gemma-3-270m': { contextWindow: 32_000, capabilities: _(text, vision, toolUse, json) },
  },

  'minimax': {
    'minimax-m2': { contextWindow: 205_000, capabilities: _(text, reasoning, toolUse, json) },
    'minimax-text-01': { contextWindow: 1_000_000, capabilities: _(text, toolUse, json) },
  },

  'deepseek': {
    'deepseek-v3-2': { contextWindow: 128_000, capabilities: _(text, reasoning, toolUse, json) },
    'deepseek-v3-1-terminus': { contextWindow: 128_000, capabilities: _(text, reasoning, toolUse, json) },
    'deepseek-r1': { contextWindow: 128_000, capabilities: _(text, reasoning, toolUse, json) },
    'deepseek-r1-0528-qwen3-8b': { contextWindow: 33_000, capabilities: _(text, reasoning, toolUse, json) },
    'deepseek-r1-distill-llama-70b': { contextWindow: 128_000, capabilities: _(text, reasoning, toolUse, json) },
  },

  'alibaba': {
    'qwen3-235b-a22b-2507': { contextWindow: 256_000, capabilities: _(text, reasoning, toolUse, json) },
    'qwen3-max': { contextWindow: 262_000, capabilities: _(text, reasoning, toolUse, json) },
    'qwen3-vl-235b-a22b-instruct': { contextWindow: 262_000, capabilities: _(text, vision, toolUse, json) },
    'qwen3-vl-235b-a22b-reasoning': { contextWindow: 262_000, capabilities: _(text, vision, reasoning, toolUse, json) },
    'qwen3-next-80b-a3b-instruct': { contextWindow: 262_000, capabilities: _(text, toolUse, json) },
    'qwen3-next-80b-a3b-reasoning': { contextWindow: 262_000, capabilities: _(text, reasoning, toolUse, json) },
    'qwen3-vl-32b-instruct': { contextWindow: 256_000, capabilities: _(text, vision, toolUse, json) },
    'qwen3-vl-32b-reasoning': { contextWindow: 256_000, capabilities: _(text, vision, reasoning, toolUse, json) },
    'qwen3-30b-a3b-2507': { contextWindow: 262_000, capabilities: _(text, reasoning, toolUse, json) },
    'qwen3-235b-2507': { contextWindow: 256_000, capabilities: _(text, reasoning, toolUse, json) },
    'qwen3-vl-30b-a3b-instruct': { contextWindow: 256_000, capabilities: _(text, vision, toolUse, json) },
    'qwen3-vl-30b-a3b-reasoning': { contextWindow: 256_000, capabilities: _(text, vision, reasoning, toolUse, json) },
    'qwen3-4b-2507-instruct': { contextWindow: 262_000, capabilities: _(text, toolUse, json) },
    'qwen3-coder-480b-a35b-instruct': { contextWindow: 262_000, capabilities: _(text, toolUse, json) },
    'qwen3-omni-30b-a3b-instruct': { contextWindow: 66_000, capabilities: _(text, toolUse, json, audio) },
    'qwen3-omni-30b-a3b-reasoning': { contextWindow: 66_000, capabilities: _(text, reasoning, toolUse, json, audio) },
    'qwen3-coder-30b-a3b-instruct': { contextWindow: 262_000, capabilities: _(text, toolUse, json) },
    'qwen3-vl-8b-reasoning': { contextWindow: 256_000, capabilities: _(text, reasoning, vision, toolUse, json) },
    'qwen3-vl-8b-instruct': { contextWindow: 256_000, capabilities: _(text, vision, toolUse, json) },
    'qwen3-vl-4b-reasoning': { contextWindow: 256_000, capabilities: _(text, reasoning, vision, toolUse, json) },
    'qwen3-vl-4b-instruct': { contextWindow: 256_000, capabilities: _(text, vision, toolUse, json) },
  },

  'zai': {
    'glm-4-6': { contextWindow: 200_000, capabilities: _(text, reasoning, toolUse, json) },
    'glm-4-5-air': { contextWindow: 128_000, capabilities: _(text, reasoning, toolUse, json) },
    'glm-4-5v': { contextWindow: 64_000, capabilities: _(text, reasoning, vision, toolUse, json) },
  },

  'mistral': {
    'magistral-medium': { contextWindow: 128_000, capabilities: _(text, vision, reasoning, toolUse, json) },
    'magistral-small': { contextWindow: 128_000, capabilities: _(text, vision, reasoning, toolUse, json) },
    'mistral-medium-3-1': { contextWindow: 128_000, capabilities: _(text, vision, toolUse, json) },
    'mistral-small-3-2': { contextWindow: 128_000, capabilities: _(text, toolUse, json) },
    'devstral-medium': { contextWindow: 256_000, capabilities: _(text, toolUse, json) },
    'devstral-small': { contextWindow: 256_000, capabilities: _(text, toolUse, json) },
    'codestral': { contextWindow: 256_000, capabilities: _(text, toolUse, json) },
    'ministral-8b-2410': { contextWindow: 128_000, capabilities: _(text, toolUse, json) },
    'ministral-3b-2410': { contextWindow: 128_000, capabilities: _(text, toolUse, json) },
  },

  'bytedance_seed': {
    'seed-oss-36b-instruct': { contextWindow: 512_000, capabilities: _(text, reasoning, toolUse, json) },
    'doubao-seed-code': { contextWindow: 256_000, capabilities: _(text, reasoning, toolUse, json) },
  },

  'servicenow': {
    'apriel-v1-5-15b-thinker': { contextWindow: 128_000, capabilities: _(text, reasoning, toolUse, json) },
  },

  'nvidia': {
    'llama-nemotron-super-49b-v1-5': { contextWindow: 128_000, capabilities: _(text, reasoning, toolUse, json) },
    'llama-nemotron-ultra': { contextWindow: 128_000, capabilities: _(text, reasoning, toolUse, json) },
    'nvidia-nemotron-nano-9b-v2': { contextWindow: 131_000, capabilities: _(text, reasoning, toolUse, json) },
    'llama-3-3-nemotron-super-49b': { contextWindow: 128_000, capabilities: _(text, reasoning, toolUse, json) },
    'llama-3-1-nemotron-nano-4b-v1-1': { contextWindow: 128_000, capabilities: _(text, reasoning, toolUse, json) },
    'llama-3-1-nemotron-70b': { contextWindow: 128_000, capabilities: _(text, toolUse, json) },
  },

  'inclusionai': {
    'ling-1t': { contextWindow: 128_000, capabilities: _(text, reasoning, toolUse, json) },
    'ring-flash-2-0': { contextWindow: 128_000, capabilities: _(text, reasoning, toolUse, json) },
    'ling-flash-2-0': { contextWindow: 128_000, capabilities: _(text, reasoning, toolUse, json) },
    'ling-mini-2-0': { contextWindow: 131_000, capabilities: _(text, reasoning, toolUse, json) },
  },

  'lg': {
    'exaone-4-0-32b': { contextWindow: 131_000, capabilities: _(text, toolUse, json) },
    'exaone-4-0-1-2b': { contextWindow: 64_000, capabilities: _(text) },
  },

  'nous-research': {
    'hermes-4-405b': { contextWindow: 128_000, capabilities: _(text, reasoning, toolUse, json) },
    'hermes-4-70b': { contextWindow: 128_000, capabilities: _(text, reasoning, toolUse, json) },
    'deephermes-3-mistral-24b-preview': { contextWindow: 32_000, capabilities: _(text, reasoning, toolUse, json) },
    'deephermes-3-llama-3-1-8b-preview': { contextWindow: 128_000, capabilities: _(text, reasoning, toolUse, json) },
  },

  'upstage': {
    'solar-pro-2': { contextWindow: 66_000, capabilities: _(text, vision, reasoning, toolUse, json) },
  },

  'meta': {
    'llama-4-maverick': { contextWindow: 1_000_000, capabilities: _(text, vision, reasoning, toolUse, json) },
    'llama-4-scout': { contextWindow: 10_000_000, capabilities: _(text, vision, reasoning, toolUse, json) },
    'llama-3-1-405b': { contextWindow: 128_000, capabilities: _(text, toolUse, json) },
    'llama-3-3-70b': { contextWindow: 128_000, capabilities: _(text, toolUse, json) },
    'llama-3-2-90b-vision': { contextWindow: 128_000, capabilities: _(text, vision, toolUse, json) },
    'llama-3-2-11b-vision': { contextWindow: 128_000, capabilities: _(text, vision, toolUse, json) },
  },

  'baidu': {
    'ernie-4-5-300b-a47b': { contextWindow: 131_000, capabilities: _(text, vision, toolUse, json) },
  },

  'aws': {
    'nova-premier': { contextWindow: 1_000_000, capabilities: _(text, vision, toolUse, json) },
    'nova-pro': { contextWindow: 300_000, capabilities: _(text, vision, toolUse, json) },
    'nova-lite': { contextWindow: 300_000, capabilities: _(text, vision, toolUse, json) },
    'nova-micro': { contextWindow: 130_000, capabilities: _(text, toolUse, json) },
  },

  'cohere': {
    'command-a': { contextWindow: 256_000, capabilities: _(text, vision, reasoning, toolUse, json) },
    'aya-expanse-32b': { contextWindow: 128_000, capabilities: _(text) },
    'aya-expanse-8b': { contextWindow: 8_000, capabilities: _(text) },
  },

  'reka-ai': {
    'reka-flash-3': { contextWindow: 128_000, capabilities: _(text, reasoning, toolUse, json) },
  },

  'ibm': {
    'granite-4-0-h-small': { contextWindow: 128_000, capabilities: _(text, toolUse, json) },
    'granite-4-0-micro': { contextWindow: 128_000, capabilities: _(text, toolUse, json) },
    'granite-4-0-h-1b': { contextWindow: 128_000, capabilities: _(text) },
    'granite-4-0-1b': { contextWindow: 128_000, capabilities: _(text) },
    'granite-4-0-h-350m': { contextWindow: 33_000, capabilities: _(text) },
    'granite-4-0-350m': { contextWindow: 33_000, capabilities: _(text) },
  },

  'azure': {
    'claude-opus-4-5': { contextWindow: 200_000, capabilities: _(text, vision, reasoning, toolUse, json) },
    'claude-4-5-sonnet': { contextWindow: 1_000_000, capabilities: _(text, vision, reasoning, toolUse, json) },
    'claude-4-5-haiku': { contextWindow: 200_000, capabilities: _(text, vision, reasoning, toolUse, json) },
    'phi-4': { contextWindow: 16_000, capabilities: _(text, reasoning, toolUse, json) },
    'phi-4-mini': { contextWindow: 128_000, capabilities: _(text, reasoning, toolUse, json) },
    'phi-4-multimodal': { contextWindow: 128_000, capabilities: _(text, vision, toolUse, json, audio) },
    'DeepSeek-V3.1': { contextWindow: 128_000, capabilities: _(text, reasoning, toolUse, json) },
    'gpt-5-mini': { contextWindow: 400_000, capabilities: _(text, vision, reasoning, toolUse, json) },
    'gpt-5-nano': { contextWindow: 400_000, capabilities: _(text, vision, reasoning, toolUse, json) },
    'gpt-5-pro': { contextWindow: 400_000, capabilities: _(text, vision, reasoning, toolUse, json) },
    'gpt-5.1': { contextWindow: 400_000, capabilities: _(text, vision, reasoning, toolUse, json) },
    'gpt-5.1-codex': { contextWindow: 400_000, capabilities: _(text, vision, reasoning, toolUse, json) },
    'gpt-oss-120b': { contextWindow: 131_000, capabilities: _(text, vision, reasoning, toolUse, json) },
    'grok-4-fast-non-reasoning': { contextWindow: 2_000_000, capabilities: _(text, vision, toolUse, json) },
    'grok-4-fast-reasoning': { contextWindow: 2_000_000, capabilities: _(text, vision, reasoning, toolUse, json) },
    'model-router': { contextWindow: 100_000, capabilities: _(text) },
  },

  'ai21-labs': {
    'jamba-reasoning-3b': { contextWindow: 262_000, capabilities: _(text, reasoning, toolUse, json) },
    'jamba-1-7-large': { contextWindow: 256_000, capabilities: _(text, toolUse, json) },
    'jamba-1-7-mini': { contextWindow: 258_000, capabilities: _(text, toolUse, json) },
  },

  'perplexity': {
    'r1-1776': { contextWindow: 128_000, capabilities: _(text, reasoning, toolUse, json) },
  },

  'liquidai': {
    'lfm2-8b-a1b': { contextWindow: 33_000, capabilities: _(text, toolUse, json) },
    'lfm2-2-6b': { contextWindow: 33_000, capabilities: _(text, toolUse, json) },
    'lfm2-1-2b': { contextWindow: 33_000, capabilities: _(text, toolUse, json) },
  },

  'cerebras': {
    'gpt-oss-120b': { contextWindow: 100_000, capabilities: _(text, reasoning, toolUse, json) },
    'llama-3.3-70b': { contextWindow: 100_000, capabilities: _(text, toolUse, json) },
    'qwen-3-235b-a22b-instruct-2507': { contextWindow: 100_000, capabilities: _(text, reasoning, toolUse, json) },
    'zai-glm-4.6': { contextWindow: 100_000, capabilities: _(text, reasoning, toolUse, json) },
  },

  'groq': {
    'llama-3.3-70b-versatile': { contextWindow: 100_000, capabilities: _(text, toolUse, json) },
    'meta-llama/llama-4-maverick-17b-128e-instruct': { contextWindow: 100_000, capabilities: _(text, vision, toolUse, json) },
    'meta-llama/llama-4-scout-17b-16e-instruct': { contextWindow: 100_000, capabilities: _(text, vision, toolUse, json) },
    'moonshotai/kimi-k2-instruct-0905': { contextWindow: 100_000, capabilities: _(text, toolUse, json) },
    'openai/gpt-oss-120b': { contextWindow: 100_000, capabilities: _(text, reasoning, toolUse, json) },
    'openai/gpt-oss-20b': { contextWindow: 100_000, capabilities: _(text, reasoning, toolUse, json) },
  },
})

/**
 * Get capabilities for a specific model
 */
export function getModelRegistry(provider: string, modelValue: string): ModelRegistry | undefined {
  const group = (MODEL_REGISTRY as RegistryMap)[provider]
  return group?.[modelValue]
}
