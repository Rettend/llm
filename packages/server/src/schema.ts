import { t } from 'elysia'

export const statusSchema = t.Union([
  t.Literal('latest'),
  t.Literal('preview'),
  t.Literal('all'),
])

export const providerSchema = t.Object({
  value: t.String({ description: 'Provider slug identifier (e.g., "openai", "anthropic")' }),
  name: t.String({ description: 'Human-readable provider name' }),
  keyPlaceholder: t.Optional(t.String({ description: 'Example format for API keys (e.g., "sk-...")' })),
  website: t.Optional(t.String({ description: 'URL to get API keys' })),
  status: t.Optional(statusSchema),
})

export const capabilitySchema = t.Object({
  text: t.Optional(t.Boolean()),
  vision: t.Optional(t.Boolean()),
  reasoning: t.Optional(t.Boolean()),
  toolUse: t.Optional(t.Boolean()),
  json: t.Optional(t.Boolean()),
  audio: t.Optional(t.Boolean()),
})

export const capabilityKeySchema = t.Union([
  t.Literal('text'),
  t.Literal('vision'),
  t.Literal('reasoning'),
  t.Literal('toolUse'),
  t.Literal('json'),
  t.Literal('audio'),
])

export const scoreSchema = t.Union([
  t.Literal(0),
  t.Literal(1),
  t.Literal(2),
  t.Literal(3),
  t.Literal(4),
  t.Literal(5),
])

export const metricsSchema = t.Object({
  contextWindow: t.Optional(t.Number({ description: 'Maximum context window in tokens' })),
  intelligenceIndex: t.Optional(t.Nullable(t.Number({ description: 'Artificial Analysis intelligence benchmark score' }))),
  codingIndex: t.Optional(t.Nullable(t.Number({ description: 'Artificial Analysis coding benchmark score' }))),
  mathIndex: t.Optional(t.Nullable(t.Number({ description: 'Artificial Analysis math benchmark score' }))),
})

export const pricingSchema = t.Object({
  input: t.Optional(t.Nullable(t.Number({ description: 'Cost per 1M input tokens (USD)' }))),
  output: t.Optional(t.Nullable(t.Number({ description: 'Cost per 1M output tokens (USD)' }))),
  blended: t.Optional(t.Nullable(t.Number({ description: 'Blended cost per 1M tokens at 3:1 input/output ratio (USD)' }))),
})

export const modeSchema = t.Union([
  t.Literal('auto'),
  t.Literal('json'),
  t.Literal('tool'),
])

export const configSchema = t.Object({
  mode: modeSchema,
})

export const modelSchema = t.Object({
  id: t.String({ description: 'Unique model identifier from Artificial Analysis' }),
  value: t.String({ description: 'Model identifier for AI SDK usage (e.g., "gpt-5", "claude-4-5-sonnet")' }),
  provider: t.String({ description: 'Provider slug this model belongs to' }),
  name: t.String({ description: 'Full display name of the model' }),
  alias: t.Optional(t.String({ description: 'Short name for UI dropdowns' })),
  capabilities: t.Optional(capabilitySchema),
  iq: t.Optional(scoreSchema),
  speed: t.Optional(scoreSchema),
  metrics: t.Optional(metricsSchema),
  pricing: t.Optional(pricingSchema),
  releaseDate: t.Optional(t.String({ description: 'Model release date (ISO 8601)' })),
  status: t.Optional(statusSchema),
  config: t.Optional(configSchema),
})

export const manifestSchema = t.Object({
  version: t.String({ description: 'Registry version identifier' }),
  etag: t.String({ description: 'ETag for caching' }),
  generatedAt: t.String({ description: 'ISO 8601 timestamp of last data update' }),
  providers: t.Array(providerSchema),
  models: t.Array(modelSchema),
})

export const modelSearchQuerySchema = t.Object({
  name: t.Optional(t.String({ description: 'Filter by partial match on model name, value, or alias' })),
  provider: t.Optional(t.String({ description: 'Filter by provider slug (e.g., "openai")' })),
  capability: t.Optional(t.Union([
    capabilityKeySchema,
    t.Array(capabilityKeySchema, { description: 'Require models that support every listed capability' }),
  ])),
  status: t.Optional(t.Union([
    statusSchema,
    t.Array(statusSchema, { description: 'Multiple statuses allowed using repeated query params' }),
  ])),
  releaseDateFrom: t.Optional(t.String({ description: 'Filter models released on/after this ISO date' })),
  releaseDateTo: t.Optional(t.String({ description: 'Filter models released on/before this ISO date' })),
  minIq: t.Optional(t.String({ description: 'Minimum IQ score (0-5)' })),
  minSpeed: t.Optional(t.String({ description: 'Minimum speed score (0-5)' })),
  minContextWindow: t.Optional(t.String({ description: 'Minimum context window in tokens' })),
  mode: t.Optional(modeSchema),
})

export const versionSchema = t.Object({
  version: t.String({ description: 'Registry version identifier' }),
  etag: t.String({ description: 'ETag for caching' }),
  generatedAt: t.String({ description: 'ISO 8601 timestamp of last data update' }),
})

export const healthSchema = t.Object({
  status: t.Literal('ok'),
})
