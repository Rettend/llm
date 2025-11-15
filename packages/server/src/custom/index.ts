import type { ModelOverride, ProviderOverride } from '@rttnd/llm-shared/custom'
import { AZURE_MODEL_OVERRIDES } from './azure'
import { CEREBRAS_MODEL_OVERRIDES } from './cerebras'
import { GROQ_MODEL_OVERRIDES } from './groq'

export const OFFICIAL_PROVIDER_OVERRIDES: ProviderOverride[] = [
  {
    value: 'groq',
    name: 'Groq',
    website: 'https://console.groq.com/keys',
    status: 'active',
  },
  {
    value: 'cerebras',
    name: 'Cerebras',
    website: 'https://cloud.cerebras.ai/',
    status: 'active',
  },
  {
    value: 'azure',
    name: 'Azure',
    website: 'https://portal.azure.com/',
    status: 'active',
  },
]

export const OFFICIAL_MODEL_OVERRIDES: ModelOverride[] = [
  ...AZURE_MODEL_OVERRIDES,
  ...GROQ_MODEL_OVERRIDES,
  ...CEREBRAS_MODEL_OVERRIDES,
]
