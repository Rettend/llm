import type { ModelOverride } from '@rttnd/llm-shared/custom'
import { scoreSpeed } from '../scoring'

export const CEREBRAS_MODEL_OVERRIDES: ModelOverride[] = [
  // #region Cerebras stable
  {
    provider: 'cerebras',
    value: 'gpt-oss-120b',
    inheritFrom: { provider: 'openai', value: 'gpt-oss-120b' },
    pricing: { input: 0.35, output: 0.75, blended: 0.45 },
    speed: scoreSpeed(3000),
    metrics: { contextWindow: 65_536 },
  },
  {
    provider: 'cerebras',
    value: 'llama-3.3-70b',
    inheritFrom: { provider: 'meta', value: 'llama-3-3-70b' },
    pricing: { input: 0.85, output: 1.20, blended: 0.9375 },
    metrics: { contextWindow: 65_536 },
  },
  // #endregion
  // #region Cerebras preview
  {
    provider: 'cerebras',
    value: 'qwen-3-235b-a22b-instruct-2507',
    inheritFrom: { provider: 'alibaba', value: 'qwen3-235b-a22b-2507' },
    status: 'preview',
    pricing: { input: 0.60, output: 1.20, blended: 0.75 },
    speed: scoreSpeed(1400),
    metrics: { contextWindow: 65_536 },
  },
  {
    provider: 'cerebras',
    value: 'zai-glm-4.7',
    inheritFrom: { provider: 'zai', value: 'glm-4-7' },
    status: 'preview',
    pricing: { input: 2.25, output: 2.75, blended: 2.375 },
    speed: scoreSpeed(1000),
    metrics: { contextWindow: 131_072 },
  },
  // #endregion
]
