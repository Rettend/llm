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

export type CapabilitiesByProvider = Record<string, Record<string, ModelCapabilities>>

export const MODEL_CAPABILITIES: CapabilitiesByProvider = {
  openai: {
    'gpt-5': {
      contextWindow: 128000,
      capabilities: {
        text: true,
        vision: true,
        reasoning: true,
        toolUse: true,
        json: true,
        audio: false,
      },
    },
    'gpt-5-mini': {
      contextWindow: 128000,
      capabilities: {
        text: true,
        vision: true,
        reasoning: false,
        toolUse: true,
        json: true,
        audio: false,
      },
    },
    'gpt-oss-20b': {
      contextWindow: 64000,
      capabilities: {
        text: true,
        vision: false,
        reasoning: false,
        toolUse: true,
        json: true,
        audio: false,
      },
    },
    'gpt-oss-120b': {
      contextWindow: 64000,
      capabilities: {
        text: true,
        vision: false,
        reasoning: false,
        toolUse: true,
        json: true,
        audio: false,
      },
    },
    'gpt-5-codex': {
      contextWindow: 128000,
      capabilities: {
        text: true,
        vision: false,
        reasoning: true,
        toolUse: true,
        json: true,
        audio: false,
      },
    },
  },

  anthropic: {
    'claude-3-5-sonnet-20241022': {
      contextWindow: 200000,
      capabilities: {
        text: true,
        vision: true,
        reasoning: false,
        toolUse: true,
        json: true,
        audio: false,
      },
    },
  },

  // TODO: Populate remaining models from AA API
}

/**
 * Get capabilities for a specific model.
 * Returns undefined if no capabilities are defined for this model.
 */
export function getModelCapabilities(provider: string, modelValue: string): ModelCapabilities | undefined {
  return MODEL_CAPABILITIES[provider]?.[modelValue]
}
