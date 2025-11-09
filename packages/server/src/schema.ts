import { t } from 'elysia'

export const providerStatusSchema = t.Union([
  t.Literal('active'),
  t.Literal('beta'),
  t.Literal('deprecated'),
])

export const providerSchema = t.Object({
  value: t.String(),
  name: t.String(),
  keyPlaceholder: t.Optional(t.String()),
  website: t.Optional(t.String()),
  status: t.Optional(providerStatusSchema),
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
  contextWindow: t.Optional(t.Number()),
  intelligenceIndex: t.Optional(t.Nullable(t.Number())),
  codingIndex: t.Optional(t.Nullable(t.Number())),
  mathIndex: t.Optional(t.Nullable(t.Number())),
})

export const pricingSchema = t.Object({
  input: t.Optional(t.Nullable(t.Number())),
  output: t.Optional(t.Nullable(t.Number())),
  blended: t.Optional(t.Nullable(t.Number())),
})

export const configSchema = t.Object({
  mode: t.Union([
    t.Literal('auto'),
    t.Literal('json'),
    t.Literal('tool'),
  ]),
})

export const modelSchema = t.Object({
  id: t.String(),
  value: t.String(),
  provider: t.String(),
  name: t.String(),
  alias: t.Optional(t.String()),
  capabilities: t.Optional(capabilitySchema),
  iq: t.Optional(scoreSchema),
  speed: t.Optional(scoreSchema),
  metrics: t.Optional(metricsSchema),
  pricing: t.Optional(pricingSchema),
  releaseDate: t.Optional(t.String()),
  status: t.Optional(providerStatusSchema),
  config: t.Optional(configSchema),
})

export const manifestSchema = t.Object({
  version: t.String(),
  etag: t.String(),
  generatedAt: t.String(),
  providers: t.Array(providerSchema),
  models: t.Array(modelSchema),
})

export const modelSearchQuerySchema = t.Object({
  name: t.Optional(t.String()),
  provider: t.Optional(t.String()),
  capability: t.Optional(capabilityKeySchema),
  minIq: t.Optional(t.String()),
  minSpeed: t.Optional(t.String()),
})

export const versionSchema = t.Object({
  version: t.String(),
  etag: t.String(),
  generatedAt: t.String(),
})

export const healthSchema = t.Object({
  status: t.Literal('ok'),
})
