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

function defineModelRegistry<T extends FlexibleRegistryMap>(map: T): { [P in keyof T]: { [M in keyof T[P]]: ModelRegistry } } {
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
  return out as { [P in keyof T]: { [M in keyof T[P]]: ModelRegistry } }
}

export const MODEL_REGISTRY = defineModelRegistry({
  'openai': {
    'gpt-5-2': { contextWindow: 400_000, capabilities: _(text, vision, reasoning, toolUse, json) },
    'gpt-5-2-codex': { contextWindow: 400_000, capabilities: _(text, vision, reasoning, toolUse, json) },
    'gpt-5-2-medium': { contextWindow: 400_000, capabilities: _(text, vision, reasoning, toolUse, json) },
    'gpt-5-2-non-reasoning': { contextWindow: 400_000, capabilities: _(text, vision, toolUse, json) },
    'gpt-5-1-codex-mini': { contextWindow: 400_000, capabilities: _(text, vision, reasoning, toolUse, json) },
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

  'xai': {
    'grok-4': { contextWindow: 256_000, capabilities: _(text, vision, reasoning, toolUse, json) },
    'grok-4-1-fast-reasoning': { contextWindow: 1_000_000, capabilities: _(text, vision, reasoning, toolUse, json) },
    'grok-4-1-fast': { contextWindow: 1_000_000, capabilities: _(text, vision, toolUse, json) },
    'grok-4-fast-reasoning': { contextWindow: 1_000_000, capabilities: _(text, vision, reasoning, toolUse, json) },
    'grok-4-fast': { contextWindow: 1_000_000, capabilities: _(text, vision, toolUse, json) },
    'grok-code-fast-1': { contextWindow: 256_000, capabilities: _(text, toolUse, json) },
    'grok-voice': { contextWindow: 32_000, capabilities: _(audio, reasoning, toolUse, json) },
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
    'gemini-3-pro-low': { contextWindow: 1_048_576, capabilities: _(text, vision, reasoning, toolUse, json, audio) },
    'gemini-3-flash': { contextWindow: 1_048_576, capabilities: _(text, vision, toolUse, json, audio) },
    'gemini-3-flash-reasoning': { contextWindow: 1_048_576, capabilities: _(text, vision, reasoning, toolUse, json, audio) },
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
    'minimax-m2-1': { contextWindow: 205_000, capabilities: _(text, reasoning, toolUse, json) },
  },

  'kimi': {
    'kimi-k2': { contextWindow: 256_000, capabilities: _(text, reasoning, toolUse, json) },
    'kimi-k2-thinking': { contextWindow: 256_000, capabilities: _(text, reasoning, toolUse, json) },
    'kimi-k2-0905': { contextWindow: 256_000, capabilities: _(text, reasoning, toolUse, json) },
    'kimi-linear-48b-a3b-instruct': { contextWindow: 1_000_000, capabilities: _(text, toolUse, json) },
  },

  'deepseek': {
    'deepseek-v3-2-reasoning': { contextWindow: 128_000, capabilities: _(text, reasoning, toolUse, json) },
    'deepseek-v3-2': { contextWindow: 128_000, capabilities: _(text, toolUse, json) },
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
    'glm-4-7': { contextWindow: 200_000, capabilities: _(text, reasoning, toolUse, json) },
    'glm-4-7-non-reasoning': { contextWindow: 200_000, capabilities: _(text, toolUse, json) },
    'glm-4-7-flash': { contextWindow: 200_000, capabilities: _(text, reasoning, toolUse, json) },
    'glm-4-7-flash-non-reasoning': { contextWindow: 200_000, capabilities: _(text, toolUse, json) },
    'glm-4-6v': { contextWindow: 128_000, capabilities: _(text, vision, toolUse, json) },
    'glm-4-6v-reasoning': { contextWindow: 128_000, capabilities: _(text, reasoning, vision, toolUse, json) },
  },

  'mistral': {
    'mistral-large-3': { contextWindow: 256_000, capabilities: _(text, toolUse, json) },
    'devstral-2': { contextWindow: 256_000, capabilities: _(text, toolUse, json) },
    'devstral-small-2': { contextWindow: 256_000, capabilities: _(text, toolUse, json) },
    'ministral-3-14b': { contextWindow: 256_000, capabilities: _(text, toolUse, json) },
    'ministral-3-3b': { contextWindow: 256_000, capabilities: _(text, toolUse, json) },
    'ministral-3-8b': { contextWindow: 256_000, capabilities: _(text, toolUse, json) },
    'magistral-medium': { contextWindow: 128_000, capabilities: _(text, vision, reasoning, toolUse, json) },
    'magistral-small': { contextWindow: 128_000, capabilities: _(text, vision, reasoning, toolUse, json) },
    'mistral-medium-3-1': { contextWindow: 128_000, capabilities: _(text, vision, toolUse, json) },
    'mistral-small-3-2': { contextWindow: 128_000, capabilities: _(text, toolUse, json) },
    'devstral-medium': { contextWindow: 256_000, capabilities: _(text, toolUse, json) },
    'devstral-small': { contextWindow: 256_000, capabilities: _(text, toolUse, json) },
  },

  'bytedance_seed': {
    'seed-oss-36b-instruct': { contextWindow: 512_000, capabilities: _(text, reasoning, toolUse, json) },
    'doubao-seed-1-8': { contextWindow: 256_000, capabilities: _(text, reasoning, toolUse, json) },
    'doubao-seed-code': { contextWindow: 256_000, capabilities: _(text, reasoning, toolUse, json) },
  },

  'servicenow': {
    'apriel-v1-6-15b-thinker': { contextWindow: 128_000, capabilities: _(text, reasoning, toolUse, json) },
  },

  'nvidia': {
    'nvidia-nemotron-3-nano-30b-a3b': { contextWindow: 1_000_000, capabilities: _(text, toolUse, json) },
    'nvidia-nemotron-3-nano-30b-a3b-reasoning': { contextWindow: 1_000_000, capabilities: _(text, reasoning, toolUse, json) },
    'nvidia-nemotron-nano-12b-v2-vl': { contextWindow: 128_000, capabilities: _(text, vision, toolUse, json) },
    'nvidia-nemotron-nano-12b-v2-vl-reasoning': { contextWindow: 128_000, capabilities: _(text, reasoning, vision, toolUse, json) },
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
    'k-exaone': { contextWindow: 256_000, capabilities: _(text, reasoning, toolUse, json) },
    'k-exaone-non-reasoning': { contextWindow: 256_000, capabilities: _(text, toolUse, json) },
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
    'solar-open-100b-reasoning': { contextWindow: 100_000, capabilities: _(text, reasoning, toolUse, json) },
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
    'ernie-5-0-thinking-preview': { contextWindow: 128_000, capabilities: _(text, reasoning, vision, toolUse, json) },
    'ernie-4-5-300b-a47b': { contextWindow: 131_000, capabilities: _(text, vision, toolUse, json) },
  },

  'aws': {
    'nova-2-0-pro': { contextWindow: 256_000, capabilities: _(text, reasoning, toolUse, json) },
    'nova-2-0-pro-reasoning-low': { contextWindow: 256_000, capabilities: _(text, reasoning, toolUse, json) },
    'nova-2-0-pro-reasoning-medium': { contextWindow: 256_000, capabilities: _(text, reasoning, toolUse, json) },
    'nova-2-0-omni': { contextWindow: 256_000, capabilities: _(text, vision, toolUse, json) },
    'nova-2-0-omni-reasoning-low': { contextWindow: 256_000, capabilities: _(text, reasoning, vision, toolUse, json) },
    'nova-2-0-omni-reasoning-medium': { contextWindow: 256_000, capabilities: _(text, reasoning, vision, toolUse, json) },
    'nova-2-0-lite': { contextWindow: 1_000_000, capabilities: _(text, toolUse, json) },
    'nova-2-0-lite-reasoning-low': { contextWindow: 1_000_000, capabilities: _(text, reasoning, toolUse, json) },
    'nova-2-0-lite-reasoning-medium': { contextWindow: 1_000_000, capabilities: _(text, reasoning, toolUse, json) },
  },

  'cohere': {
    'command-a': { contextWindow: 256_000, capabilities: _(text, vision, reasoning, toolUse, json) },
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
    'lfm2-5-1-2b-instruct': { contextWindow: 32_000, capabilities: _(text, toolUse, json) },
    'lfm2-5-1-2b-thinking': { contextWindow: 32_000, capabilities: _(text, reasoning, toolUse, json) },
    'lfm2-5-vl-1-6b': { contextWindow: 32_000, capabilities: _(text, vision, toolUse, json) },
  },

  'cerebras': {
    'zai-glm-4.7': { contextWindow: 131_000, capabilities: _(text, reasoning, toolUse, json) },
    'gpt-oss-120b': { contextWindow: 131_000, capabilities: _(text, reasoning, toolUse, json) },
    'llama-3.3-70b': { contextWindow: 128_000, capabilities: _(text, toolUse, json) },
    'qwen-3-235b-a22b-instruct-2507': { contextWindow: 131_000, capabilities: _(text, toolUse, json) },
  },

  'groq': {
    'llama-3.3-70b-versatile': { contextWindow: 131_000, capabilities: _(text, toolUse, json) },
    'meta-llama/llama-4-maverick-17b-128e-instruct': { contextWindow: 131_000, capabilities: _(text, vision, toolUse, json) },
    'meta-llama/llama-4-scout-17b-16e-instruct': { contextWindow: 131_000, capabilities: _(text, vision, toolUse, json) },
    'moonshotai/kimi-k2-instruct-0905': { contextWindow: 262_000, capabilities: _(text, toolUse, json) },
    'openai/gpt-oss-120b': { contextWindow: 131_000, capabilities: _(text, reasoning, toolUse, json) },
    'openai/gpt-oss-20b': { contextWindow: 131_000, capabilities: _(text, reasoning, toolUse, json) },
  },

  'ai2': {
    'olmo-3-1-32b-instruct': { contextWindow: 66_000, capabilities: _(text, toolUse, json) },
    'olmo-3-1-32b-think': { contextWindow: 66_000, capabilities: _(text, reasoning, toolUse, json) },
    'olmo-3-7b-instruct': { contextWindow: 66_000, capabilities: _(text, toolUse, json) },
    'olmo-3-7b-think': { contextWindow: 66_000, capabilities: _(text, reasoning, toolUse, json) },
    'molmo2-8b': { contextWindow: 4_000, capabilities: _(text, vision, toolUse, json) },
  },

  'korea-telecom': {
    'mi-dm-k-2-5-pro-dec28': { contextWindow: 128_000, capabilities: _(text, reasoning, toolUse, json) },
  },

  'mbzuai': {
    'k2-v2': { contextWindow: 262_000, capabilities: _(text, reasoning, toolUse, json) },
    'k2-v2-low': { contextWindow: 100_000, capabilities: _(text, reasoning, toolUse, json) },
    'k2-v2-medium': { contextWindow: 100_000, capabilities: _(text, reasoning, toolUse, json) },
  },

  'motif-technologies': {
    'motif-2-12-7b': { contextWindow: 128_000, capabilities: _(text, reasoning, toolUse, json) },
  },

  'naver': {
    'hyperclova-x-seed-think-32b': { contextWindow: 128_000, capabilities: _(text, reasoning, vision, toolUse, json) },
  },

  'prime-intellect': {
    'intellect-3': { contextWindow: 131_000, capabilities: _(text, reasoning, toolUse, json) },
  },

  'tii-uae': {
    'falcon-h1r-7b': { contextWindow: 256_000, capabilities: _(text, reasoning, toolUse, json) },
  },

  'xiaomi': {
    'mimo-v2-flash': { contextWindow: 256_000, capabilities: _(text, toolUse, json) },
    'mimo-v2-flash-reasoning': { contextWindow: 256_000, capabilities: _(text, reasoning, toolUse, json) },
  },
})

/**
 * Get capabilities for a specific model
 */
export function getModelRegistry(provider: string, modelValue: string): ModelRegistry | undefined {
  const group = (MODEL_REGISTRY as RegistryMap)[provider]
  return group?.[modelValue]
}

export type Registry = typeof MODEL_REGISTRY
export type RegistryProvider = keyof Registry
export type RegistryModel<P extends RegistryProvider> = keyof Registry[P]
