import type { ModelOverride } from '@rttnd/llm-shared/custom'
import { scoreSpeed } from '../scoring'

export const GROQ_MODEL_OVERRIDES: ModelOverride[] = [
  // #region Groq stable
  {
    provider: 'groq',
    value: 'llama-3.3-70b-versatile',
    inheritFrom: {
      provider: 'meta',
      value: 'llama-3-3-70b',
    },
    pricing: {
      input: 0.59,
      output: 0.79,
      blended: 0.64,
    },
    speed: scoreSpeed(280),
    metrics: {
      contextWindow: 131_072,
    },
  },
  {
    provider: 'groq',
    value: 'openai/gpt-oss-120b',
    inheritFrom: {
      provider: 'openai',
      value: 'gpt-oss-120b',
    },
    pricing: {
      input: 0.15,
      output: 0.60,
      blended: 0.2625,
    },
    speed: scoreSpeed(500),
    metrics: {
      contextWindow: 131_072,
    },
  },
  {
    provider: 'groq',
    value: 'openai/gpt-oss-20b',
    inheritFrom: {
      provider: 'openai',
      value: 'gpt-oss-20b',
    },
    pricing: {
      input: 0.075,
      output: 0.30,
      blended: 0.13125,
    },
    speed: scoreSpeed(1000),
    metrics: {
      contextWindow: 131_072,
    },
  },
  // #endregion
  // #region Groq preview
  {
    provider: 'groq',
    value: 'meta-llama/llama-4-maverick-17b-128e-instruct',
    inheritFrom: {
      provider: 'meta',
      value: 'llama-4-maverick',
    },
    status: 'preview',
    pricing: {
      input: 0.20,
      output: 0.60,
      blended: 0.3,
    },
    speed: scoreSpeed(600),
    metrics: {
      contextWindow: 131_072,
    },
  },
  {
    provider: 'groq',
    value: 'meta-llama/llama-4-scout-17b-16e-instruct',
    inheritFrom: {
      provider: 'meta',
      value: 'llama-4-scout',
    },
    status: 'preview',
    pricing: {
      input: 0.11,
      output: 0.34,
      blended: 0.1675,
    },
    speed: scoreSpeed(750),
    metrics: {
      contextWindow: 131_072,
    },
  },
  {
    provider: 'groq',
    value: 'moonshotai/kimi-k2-instruct-0905',
    inheritFrom: {
      provider: 'moonshotai',
      value: 'kimi-k2-0905',
    },
    status: 'preview',
    pricing: {
      input: 1.0,
      output: 3.0,
      blended: 1.5,
    },
    speed: scoreSpeed(200),
    metrics: {
      contextWindow: 262_144,
    },
  },
  // #endregion
]
