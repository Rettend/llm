import type { ReasoningControl, Status } from './types'
import { getModelReasoningControl } from './reasoning-data'

export type ModelStatus = Status

export interface ModelRegistry {
  status: ModelStatus
  contextWindow: number
  reasoningControl?: ReasoningControl
  capabilities: {
    text: boolean
    vision?: boolean
    reasoning?: boolean
    audio?: boolean
  }
}

type RegistryMap = Record<string, Record<string, ModelRegistry>>

export type CapabilityKey = 'text' | 'vision' | 'reasoning' | 'audio'
type CapabilityFlags = { [K in CapabilityKey]?: boolean }
type CanonicalCapabilities = { text: boolean } & { [K in Exclude<CapabilityKey, 'text'>]?: boolean }

export const text: CapabilityKey = 'text'
export const vision: CapabilityKey = 'vision'
export const reasoning: CapabilityKey = 'reasoning'
export const audio: CapabilityKey = 'audio'

const ALL_CAP_KEYS: readonly CapabilityKey[] = [
  'text',
  'vision',
  'reasoning',
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
    'gpt-5-3-codex': { contextWindow: 400_000, capabilities: _(text, vision, reasoning) },
    'gpt-5-2': { contextWindow: 400_000, capabilities: _(text, vision, reasoning) },
    'gpt-5-2-codex': { contextWindow: 400_000, capabilities: _(text, vision, reasoning) },
    'gpt-5-2-medium': { contextWindow: 400_000, capabilities: _(text, vision, reasoning) },
    'gpt-5-2-non-reasoning': { contextWindow: 400_000, capabilities: _(text, vision) },
    'gpt-5-1-codex-mini': { contextWindow: 400_000, capabilities: _(text, vision, reasoning) },
    'gpt-5-mini': { contextWindow: 400_000, capabilities: _(text, vision, reasoning) },
    'gpt-5-mini-medium': { contextWindow: 400_000, capabilities: _(text, vision, reasoning) },
    'gpt-oss-120b': { contextWindow: 131_000, capabilities: _(text, vision, reasoning) },
    'gpt-oss-20b': { contextWindow: 131_000, capabilities: _(text, vision, reasoning) },
    'gpt-5-nano': { contextWindow: 400_000, capabilities: _(text, vision, reasoning) },
    'gpt-5-nano-medium': { contextWindow: 400_000, capabilities: _(text, vision, reasoning) },
    'gpt-oss-120b-low': { contextWindow: 131_000, capabilities: _(text, vision, reasoning) },
    'gpt-oss-20b-low': { contextWindow: 131_000, capabilities: _(text, vision, reasoning) },
    'gpt-5-minimal': { contextWindow: 400_000, capabilities: _(text, vision, reasoning) },
    'gpt-5-mini-minimal': { contextWindow: 400_000, capabilities: _(text, vision, reasoning) },
    'gpt-5-nano-minimal': { contextWindow: 400_000, capabilities: _(text, vision, reasoning) },
  },

  'xai': {
    'grok-4': { contextWindow: 256_000, capabilities: _(text, vision, reasoning) },
    'grok-4-1-fast-reasoning': { contextWindow: 1_000_000, capabilities: _(text, vision, reasoning) },
    'grok-4-1-fast': { contextWindow: 1_000_000, capabilities: _(text, vision) },
    'grok-4-fast-reasoning': { contextWindow: 1_000_000, capabilities: _(text, vision, reasoning) },
    'grok-4-fast': { contextWindow: 1_000_000, capabilities: _(text, vision) },
    'grok-code-fast-1': { contextWindow: 256_000, capabilities: _(text) },
    'grok-voice': { contextWindow: 32_000, capabilities: _(audio, reasoning) },
  },

  'anthropic': {
    'claude-opus-4-6': { contextWindow: 200_000, capabilities: _(text, vision) },
    'claude-opus-4-6-adaptive': { contextWindow: 200_000, capabilities: _(text, vision, reasoning) },
    'claude-sonnet-4-6': { contextWindow: 200_000, capabilities: _(text, vision) },
    'claude-sonnet-4-6-adaptive': { contextWindow: 200_000, capabilities: _(text, vision, reasoning) },
    'claude-sonnet-4-6-non-reasoning-low-effort': { contextWindow: 200_000, capabilities: _(text, vision) },
    'claude-opus-4-5': { contextWindow: 200_000, capabilities: _(text, vision) },
    'claude-opus-4-5-thinking': { contextWindow: 200_000, capabilities: _(text, vision, reasoning) },
    'claude-4-5-sonnet': { contextWindow: 1_000_000, capabilities: _(text, vision) },
    'claude-4-5-sonnet-thinking': { contextWindow: 1_000_000, capabilities: _(text, vision, reasoning) },
    'claude-4-5-haiku': { contextWindow: 200_000, capabilities: _(text, vision) },
    'claude-4-5-haiku-reasoning': { contextWindow: 200_000, capabilities: _(text, vision, reasoning) },
  },

  'google': {
    'gemini-3-1-flash-lite-preview': { contextWindow: 1_000_000, capabilities: _(text, vision, audio, reasoning) },
    'gemini-3-1-pro-preview': { contextWindow: 1_000_000, capabilities: _(text, vision, audio, reasoning) },
    'gemini-3-pro': { contextWindow: 1_048_576, capabilities: _(text, vision, reasoning, audio) },
    'gemini-3-pro-low': { contextWindow: 1_048_576, capabilities: _(text, vision, reasoning, audio) },
    'gemini-3-flash': { contextWindow: 1_048_576, capabilities: _(text, vision, audio) },
    'gemini-3-flash-reasoning': { contextWindow: 1_048_576, capabilities: _(text, vision, reasoning, audio) },
    'gemini-2-5-pro': { contextWindow: 1_048_576, capabilities: _(text, vision, reasoning, audio) },
    'gemini-2-5-flash': { contextWindow: 1_048_576, capabilities: _(text, vision, reasoning, audio) },
    'gemini-2-5-flash-lite': { contextWindow: 1_048_576, capabilities: _(text, vision, reasoning) },
    'gemma-3-27b': { contextWindow: 128_000, capabilities: _(text, vision) },
    'gemma-3-12b': { contextWindow: 128_000, capabilities: _(text, vision) },
    'gemma-3n-e4b': { contextWindow: 32_000, capabilities: _(text, vision, audio) },
    'gemma-3-4b': { contextWindow: 128_000, capabilities: _(text, vision) },
    'gemma-3n-e2b': { contextWindow: 32_000, capabilities: _(text, vision, audio) },
    'gemma-3-1b': { contextWindow: 32_000, capabilities: _(text, vision) },
    'gemma-3-270m': { contextWindow: 32_000, capabilities: _(text, vision) },
  },

  'minimax': {
    'minimax-m2-5': { contextWindow: 200_000, capabilities: _(text, reasoning) },
    'minimax-m2-1': { contextWindow: 205_000, capabilities: _(text, reasoning) },
  },

  'kimi': {
    'kimi-k2-5': { contextWindow: 260_000, capabilities: _(text, vision, reasoning) },
    'kimi-k2-5-non-reasoning': { contextWindow: 260_000, capabilities: _(text, vision) },
    'kimi-k2': { contextWindow: 256_000, capabilities: _(text, reasoning) },
    'kimi-k2-thinking': { contextWindow: 256_000, capabilities: _(text, reasoning) },
    'kimi-k2-0905': { contextWindow: 256_000, capabilities: _(text, reasoning) },
    'kimi-linear-48b-a3b-instruct': { contextWindow: 1_000_000, capabilities: _(text) },
  },

  'deepseek': {
    'deepseek-v3-2-reasoning': { contextWindow: 128_000, capabilities: _(text, reasoning) },
    'deepseek-v3-2': { contextWindow: 128_000, capabilities: _(text) },
  },

  'alibaba': {
    'qwen3-5-122b-a10b': { contextWindow: 260_000, capabilities: _(text, vision, reasoning) },
    'qwen3-5-122b-a10b-non-reasoning': { contextWindow: 260_000, capabilities: _(text, vision) },
    'qwen3-5-27b': { contextWindow: 260_000, capabilities: _(text, vision, reasoning) },
    'qwen3-5-27b-non-reasoning': { contextWindow: 260_000, capabilities: _(text, vision) },
    'qwen3-5-35b-a3b': { contextWindow: 260_000, capabilities: _(text, vision, reasoning) },
    'qwen3-5-35b-a3b-non-reasoning': { contextWindow: 260_000, capabilities: _(text, vision) },
    'qwen3-5-397b-a17b': { contextWindow: 260_000, capabilities: _(text, vision, reasoning) },
    'qwen3-5-397b-a17b-non-reasoning': { contextWindow: 260_000, capabilities: _(text, vision) },
    'qwen3-coder-next': { contextWindow: 260_000, capabilities: _(text) },
    'qwen3-max-thinking-preview': { contextWindow: 260_000, capabilities: _(text, reasoning) },
    'qwen3-235b-a22b-2507': { contextWindow: 256_000, capabilities: _(text, reasoning) },
    'qwen3-max': { contextWindow: 262_000, capabilities: _(text, reasoning) },
    'qwen3-vl-235b-a22b-instruct': { contextWindow: 262_000, capabilities: _(text, vision) },
    'qwen3-vl-235b-a22b-reasoning': { contextWindow: 262_000, capabilities: _(text, vision, reasoning) },
    'qwen3-next-80b-a3b-instruct': { contextWindow: 262_000, capabilities: _(text) },
    'qwen3-next-80b-a3b-reasoning': { contextWindow: 262_000, capabilities: _(text, reasoning) },
    'qwen3-vl-32b-instruct': { contextWindow: 256_000, capabilities: _(text, vision) },
    'qwen3-vl-32b-reasoning': { contextWindow: 256_000, capabilities: _(text, vision, reasoning) },
    'qwen3-30b-a3b-2507': { contextWindow: 262_000, capabilities: _(text, reasoning) },
    'qwen3-235b-2507': { contextWindow: 256_000, capabilities: _(text, reasoning) },
    'qwen3-vl-30b-a3b-instruct': { contextWindow: 256_000, capabilities: _(text, vision) },
    'qwen3-vl-30b-a3b-reasoning': { contextWindow: 256_000, capabilities: _(text, vision, reasoning) },
    'qwen3-4b-2507-instruct': { contextWindow: 262_000, capabilities: _(text) },
    'qwen3-coder-480b-a35b-instruct': { contextWindow: 262_000, capabilities: _(text) },
    'qwen3-omni-30b-a3b-instruct': { contextWindow: 66_000, capabilities: _(text, audio) },
    'qwen3-omni-30b-a3b-reasoning': { contextWindow: 66_000, capabilities: _(text, reasoning, audio) },
    'qwen3-coder-30b-a3b-instruct': { contextWindow: 262_000, capabilities: _(text) },
    'qwen3-vl-8b-reasoning': { contextWindow: 256_000, capabilities: _(text, reasoning, vision) },
    'qwen3-vl-8b-instruct': { contextWindow: 256_000, capabilities: _(text, vision) },
    'qwen3-vl-4b-reasoning': { contextWindow: 256_000, capabilities: _(text, reasoning, vision) },
    'qwen3-vl-4b-instruct': { contextWindow: 256_000, capabilities: _(text, vision) },
  },

  'zai': {
    'glm-5': { contextWindow: 200_000, capabilities: _(text, reasoning) },
    'glm-5-non-reasoning': { contextWindow: 200_000, capabilities: _(text) },
    'glm-4-7': { contextWindow: 200_000, capabilities: _(text, reasoning) },
    'glm-4-7-non-reasoning': { contextWindow: 200_000, capabilities: _(text) },
    'glm-4-7-flash': { contextWindow: 200_000, capabilities: _(text, reasoning) },
    'glm-4-7-flash-non-reasoning': { contextWindow: 200_000, capabilities: _(text) },
    'glm-4-6v': { contextWindow: 128_000, capabilities: _(text, vision) },
    'glm-4-6v-reasoning': { contextWindow: 128_000, capabilities: _(text, reasoning, vision) },
  },

  'mistral': {
    'mistral-large-3': { contextWindow: 256_000, capabilities: _(text) },
    'devstral-2': { contextWindow: 256_000, capabilities: _(text) },
    'devstral-small-2': { contextWindow: 256_000, capabilities: _(text) },
    'ministral-3-14b': { contextWindow: 256_000, capabilities: _(text) },
    'ministral-3-3b': { contextWindow: 256_000, capabilities: _(text) },
    'ministral-3-8b': { contextWindow: 256_000, capabilities: _(text) },
    'magistral-medium': { contextWindow: 128_000, capabilities: _(text, vision, reasoning) },
    'magistral-small': { contextWindow: 128_000, capabilities: _(text, vision, reasoning) },
    'mistral-medium-3-1': { contextWindow: 128_000, capabilities: _(text, vision) },
    'mistral-small-3-2': { contextWindow: 128_000, capabilities: _(text) },
    'devstral-medium': { contextWindow: 256_000, capabilities: _(text) },
    'devstral-small': { contextWindow: 256_000, capabilities: _(text) },
  },

  'bytedance_seed': {
    'seed-oss-36b-instruct': { contextWindow: 512_000, capabilities: _(text, reasoning) },
    'doubao-seed-1-8': { contextWindow: 256_000, capabilities: _(text, reasoning) },
    'doubao-seed-code': { contextWindow: 256_000, capabilities: _(text, reasoning) },
  },

  'servicenow': {
    'apriel-v1-6-15b-thinker': { contextWindow: 128_000, capabilities: _(text, reasoning) },
  },

  'nvidia': {
    'nvidia-nemotron-3-nano-30b-a3b': { contextWindow: 1_000_000, capabilities: _(text) },
    'nvidia-nemotron-3-nano-30b-a3b-reasoning': { contextWindow: 1_000_000, capabilities: _(text, reasoning) },
    'nvidia-nemotron-nano-12b-v2-vl': { contextWindow: 128_000, capabilities: _(text, vision) },
    'nvidia-nemotron-nano-12b-v2-vl-reasoning': { contextWindow: 128_000, capabilities: _(text, reasoning, vision) },
    'llama-nemotron-super-49b-v1-5': { contextWindow: 128_000, capabilities: _(text, reasoning) },
    'llama-nemotron-ultra': { contextWindow: 128_000, capabilities: _(text, reasoning) },
    'nvidia-nemotron-nano-9b-v2': { contextWindow: 131_000, capabilities: _(text, reasoning) },
    'llama-3-3-nemotron-super-49b': { contextWindow: 128_000, capabilities: _(text, reasoning) },
    'llama-3-1-nemotron-nano-4b-v1-1': { contextWindow: 128_000, capabilities: _(text, reasoning) },
    'llama-3-1-nemotron-70b': { contextWindow: 128_000, capabilities: _(text) },
  },

  'inclusionai': {
    'ling-1t': { contextWindow: 128_000, capabilities: _(text, reasoning) },
    'ring-flash-2-0': { contextWindow: 128_000, capabilities: _(text, reasoning) },
    'ling-flash-2-0': { contextWindow: 128_000, capabilities: _(text, reasoning) },
    'ling-mini-2-0': { contextWindow: 131_000, capabilities: _(text, reasoning) },
  },

  'lg': {
    'k-exaone': { contextWindow: 256_000, capabilities: _(text, reasoning) },
    'k-exaone-non-reasoning': { contextWindow: 256_000, capabilities: _(text) },
    'exaone-4-0-32b': { contextWindow: 131_000, capabilities: _(text) },
    'exaone-4-0-1-2b': { contextWindow: 64_000, capabilities: _(text) },
  },

  'nous-research': {
    'hermes-4-405b': { contextWindow: 128_000, capabilities: _(text, reasoning) },
    'hermes-4-70b': { contextWindow: 128_000, capabilities: _(text, reasoning) },
    'deephermes-3-mistral-24b-preview': { contextWindow: 32_000, capabilities: _(text, reasoning) },
    'deephermes-3-llama-3-1-8b-preview': { contextWindow: 128_000, capabilities: _(text, reasoning) },
  },

  'upstage': {
    'solar-open-100b-reasoning': { contextWindow: 100_000, capabilities: _(text, reasoning) },
    'solar-pro-2': { contextWindow: 66_000, capabilities: _(text, vision, reasoning) },
  },

  'meta': {
    'llama-4-maverick': { contextWindow: 1_000_000, capabilities: _(text, vision, reasoning) },
    'llama-4-scout': { contextWindow: 10_000_000, capabilities: _(text, vision, reasoning) },
    'llama-3-1-405b': { contextWindow: 128_000, capabilities: _(text) },
    'llama-3-3-70b': { contextWindow: 128_000, capabilities: _(text) },
    'llama-3-2-90b-vision': { contextWindow: 128_000, capabilities: _(text, vision) },
    'llama-3-2-11b-vision': { contextWindow: 128_000, capabilities: _(text, vision) },
  },

  'baidu': {
    'ernie-5-0-thinking-preview': { contextWindow: 128_000, capabilities: _(text, reasoning, vision) },
    'ernie-4-5-300b-a47b': { contextWindow: 131_000, capabilities: _(text, vision) },
  },

  'aws': {
    'nova-2-0-pro': { contextWindow: 256_000, capabilities: _(text, reasoning) },
    'nova-2-0-pro-reasoning-low': { contextWindow: 256_000, capabilities: _(text, reasoning) },
    'nova-2-0-pro-reasoning-medium': { contextWindow: 256_000, capabilities: _(text, reasoning) },
    'nova-2-0-omni': { contextWindow: 256_000, capabilities: _(text, vision) },
    'nova-2-0-omni-reasoning-low': { contextWindow: 256_000, capabilities: _(text, reasoning, vision) },
    'nova-2-0-omni-reasoning-medium': { contextWindow: 256_000, capabilities: _(text, reasoning, vision) },
    'nova-2-0-lite': { contextWindow: 1_000_000, capabilities: _(text) },
    'nova-2-0-lite-reasoning-low': { contextWindow: 1_000_000, capabilities: _(text, reasoning) },
    'nova-2-0-lite-reasoning-medium': { contextWindow: 1_000_000, capabilities: _(text, reasoning) },
  },

  'cohere': {
    'command-a': { contextWindow: 256_000, capabilities: _(text, vision, reasoning) },
  },

  'reka-ai': {
    'reka-flash-3': { contextWindow: 128_000, capabilities: _(text, reasoning) },
  },

  'trillionlabs': {
    'tri-21b-think-preview': { contextWindow: 32_000, capabilities: _(text, reasoning) },
    'tri-21b-think-v0-5': { contextWindow: 32_000, capabilities: _(text, reasoning) },
  },

  'stepfun': {
    'step3-vl-10b': { contextWindow: 66_000, capabilities: _(text, vision, reasoning) },
  },

  'inception': {
    'mercury-2': { contextWindow: 130_000, capabilities: _(text, reasoning) },
  },

  'ibm': {
    'granite-4-0-h-small': { contextWindow: 128_000, capabilities: _(text) },
    'granite-4-0-micro': { contextWindow: 128_000, capabilities: _(text) },
    'granite-4-0-h-1b': { contextWindow: 128_000, capabilities: _(text) },
    'granite-4-0-1b': { contextWindow: 128_000, capabilities: _(text) },
    'granite-4-0-h-350m': { contextWindow: 33_000, capabilities: _(text) },
    'granite-4-0-350m': { contextWindow: 33_000, capabilities: _(text) },
  },

  'azure': {
    'DeepSeek-V3.2': { contextWindow: 130_000, capabilities: _(text) },
    'gpt-5.2': { contextWindow: 400_000, capabilities: _(text, vision, reasoning) },
    'gpt-5.2-codex': { contextWindow: 400_000, capabilities: _(text, vision, reasoning) },
    'claude-opus-4-5': { contextWindow: 200_000, capabilities: _(text, vision, reasoning) },
    'claude-4-5-sonnet': { contextWindow: 1_000_000, capabilities: _(text, vision, reasoning) },
    'claude-4-5-haiku': { contextWindow: 200_000, capabilities: _(text, vision, reasoning) },
    'phi-4': { contextWindow: 16_000, capabilities: _(text, reasoning) },
    'phi-4-mini': { contextWindow: 128_000, capabilities: _(text, reasoning) },
    'phi-4-multimodal': { contextWindow: 128_000, capabilities: _(text, vision, audio) },
    'DeepSeek-V3.1': { contextWindow: 128_000, capabilities: _(text, reasoning) },
    'gpt-5-mini': { contextWindow: 400_000, capabilities: _(text, vision, reasoning) },
    'gpt-5-nano': { contextWindow: 400_000, capabilities: _(text, vision, reasoning) },
    'gpt-5-pro': { contextWindow: 400_000, capabilities: _(text, vision, reasoning) },
    'gpt-5.1': { contextWindow: 400_000, capabilities: _(text, vision, reasoning) },
    'gpt-5.1-codex': { contextWindow: 400_000, capabilities: _(text, vision, reasoning) },
    'gpt-oss-120b': { contextWindow: 131_000, capabilities: _(text, vision, reasoning) },
    'grok-4-fast-non-reasoning': { contextWindow: 2_000_000, capabilities: _(text, vision) },
    'grok-4-fast-reasoning': { contextWindow: 2_000_000, capabilities: _(text, vision, reasoning) },
    'model-router': { contextWindow: 100_000, capabilities: _(text) },
  },

  'ai21-labs': {
    'jamba-reasoning-3b': { contextWindow: 262_000, capabilities: _(text, reasoning) },
    'jamba-1-7-large': { contextWindow: 256_000, capabilities: _(text) },
    'jamba-1-7-mini': { contextWindow: 258_000, capabilities: _(text) },
  },

  'perplexity': {
    'r1-1776': { contextWindow: 128_000, capabilities: _(text, reasoning) },
  },

  'liquidai': {
    'lfm2-24b-a2b': { contextWindow: 33_000, capabilities: _(text) },
    'lfm2-5-1-2b-instruct': { contextWindow: 32_000, capabilities: _(text) },
    'lfm2-5-1-2b-thinking': { contextWindow: 32_000, capabilities: _(text, reasoning) },
    'lfm2-5-vl-1-6b': { contextWindow: 32_000, capabilities: _(text, vision) },
  },

  'cerebras': {
    'zai-glm-4.7': { contextWindow: 131_000, capabilities: _(text, reasoning) },
    'gpt-oss-120b': { contextWindow: 131_000, capabilities: _(text, reasoning) },
    'llama-3.3-70b': { contextWindow: 128_000, capabilities: _(text) },
    'qwen-3-235b-a22b-instruct-2507': { contextWindow: 131_000, capabilities: _(text) },
  },

  'groq': {
    'llama-3.3-70b-versatile': { contextWindow: 131_000, capabilities: _(text) },
    'meta-llama/llama-4-maverick-17b-128e-instruct': { contextWindow: 131_000, capabilities: _(text, vision) },
    'meta-llama/llama-4-scout-17b-16e-instruct': { contextWindow: 131_000, capabilities: _(text, vision) },
    'moonshotai/kimi-k2-instruct-0905': { contextWindow: 262_000, capabilities: _(text) },
    'openai/gpt-oss-120b': { contextWindow: 131_000, capabilities: _(text, reasoning) },
    'openai/gpt-oss-20b': { contextWindow: 131_000, capabilities: _(text, reasoning) },
  },

  'ai2': {
    'olmo-3-1-32b-instruct': { contextWindow: 66_000, capabilities: _(text) },
    'olmo-3-1-32b-think': { contextWindow: 66_000, capabilities: _(text, reasoning) },
    'olmo-3-7b-instruct': { contextWindow: 66_000, capabilities: _(text) },
    'olmo-3-7b-think': { contextWindow: 66_000, capabilities: _(text, reasoning) },
    'molmo2-8b': { contextWindow: 4_000, capabilities: _(text, vision) },
  },

  'korea-telecom': {
    'mi-dm-k-2-5-pro-dec28': { contextWindow: 128_000, capabilities: _(text, reasoning) },
  },

  'mbzuai': {
    'k2-think-v2': { contextWindow: 260_000, capabilities: _(text, reasoning) },
    'k2-v2': { contextWindow: 262_000, capabilities: _(text, reasoning) },
    'k2-v2-low': { contextWindow: 100_000, capabilities: _(text, reasoning) },
    'k2-v2-medium': { contextWindow: 100_000, capabilities: _(text, reasoning) },
  },

  'motif-technologies': {
    'motif-2-12-7b': { contextWindow: 128_000, capabilities: _(text, reasoning) },
  },

  'naver': {
    'hyperclova-x-seed-think-32b': { contextWindow: 128_000, capabilities: _(text, reasoning, vision) },
  },

  'prime-intellect': {
    'intellect-3': { contextWindow: 131_000, capabilities: _(text, reasoning) },
  },

  'tii-uae': {
    'falcon-h1r-7b': { contextWindow: 256_000, capabilities: _(text, reasoning) },
  },

  'xiaomi': {
    'mimo-v2-0206': { contextWindow: 260_000, capabilities: _(text, reasoning) },
    'mimo-v2-flash': { contextWindow: 256_000, capabilities: _(text) },
    'mimo-v2-flash-reasoning': { contextWindow: 256_000, capabilities: _(text, reasoning) },
  },
})

/**
 * Get capabilities for a specific model
 */
export function getModelRegistry(provider: string, modelValue: string): ModelRegistry | undefined {
  const group = (MODEL_REGISTRY as RegistryMap)[provider]
  const model = group?.[modelValue]
  if (!model)
    return undefined

  const reasoningControl = getModelReasoningControl(provider, modelValue)
  if (!reasoningControl)
    return model

  return {
    ...model,
    reasoningControl,
  }
}

export type Registry = typeof MODEL_REGISTRY
export type RegistryProvider = keyof Registry
export type RegistryModel<P extends RegistryProvider> = keyof Registry[P]
