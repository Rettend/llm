import type { ModelOverride } from '@rttnd/llm-shared/custom'

export const AZURE_MODEL_OVERRIDES: ModelOverride[] = [
  {
    provider: 'azure',
    value: 'DeepSeek-V3.1',
    inheritFrom: {
      provider: 'deepseek',
      value: 'deepseek-v3-1-terminus',
    },
  },
  {
    provider: 'azure',
    value: 'gpt-5-mini',
    inheritFrom: {
      provider: 'openai',
      value: 'gpt-5-mini',
    },
  },
  {
    provider: 'azure',
    value: 'gpt-5-nano',
    inheritFrom: {
      provider: 'openai',
      value: 'gpt-5-nano',
    },
  },
  {
    provider: 'azure',
    value: 'gpt-5.1',
    inheritFrom: {
      provider: 'openai',
      value: 'gpt-5-1',
    },
  },
  {
    provider: 'azure',
    value: 'gpt-5.1-codex',
    inheritFrom: {
      provider: 'openai',
      value: 'gpt-5-codex',
    },
  },
  {
    provider: 'azure',
    value: 'gpt-5-pro',
    name: 'GPT-5 Pro',
  },
  {
    provider: 'azure',
    value: 'gpt-oss-120b',
    inheritFrom: {
      provider: 'openai',
      value: 'gpt-oss-120b',
    },
  },
  {
    provider: 'azure',
    value: 'grok-4-fast-non-reasoning',
    inheritFrom: {
      provider: 'xai',
      value: 'grok-4-fast',
    },
  },
  {
    provider: 'azure',
    value: 'grok-4-fast-reasoning',
    inheritFrom: {
      provider: 'xai',
      value: 'grok-4-fast-reasoning',
    },
  },
  {
    provider: 'azure',
    value: 'model-router',
    inheritFrom: {
      provider: 'openai',
      value: 'gpt-5-1',
    },
    name: 'Model Router',
  },
]
