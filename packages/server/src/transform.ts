import type { AAModel, AAResponse, Manifest, Model, Provider, Status } from '@rttnd/llm-shared'
import { applyOverrides } from '@rttnd/llm-shared/custom'
import { getModelRegistry } from '@rttnd/llm-shared/registry'
import { OFFICIAL_MODEL_OVERRIDES, OFFICIAL_PROVIDER_OVERRIDES } from './custom/index'
import { scoreIq, scoreSpeed } from './scoring'

const PROVIDER_MAP: Record<string, { value: string, name: string, keyPlaceholder?: string, website?: string }> = {
  'openai': {
    value: 'openai',
    name: 'OpenAI',
    keyPlaceholder: 'sk-...',
    website: 'https://platform.openai.com/api-keys',
  },
  'anthropic': {
    value: 'anthropic',
    name: 'Anthropic',
    keyPlaceholder: 'sk-ant-...',
    website: 'https://console.anthropic.com/settings/keys',
  },
  'google': {
    value: 'google',
    name: 'Google',
    keyPlaceholder: 'AI...',
    website: 'https://aistudio.google.com/app/apikey',
  },
  'mistral': {
    value: 'mistral',
    name: 'Mistral',
    website: 'https://console.mistral.ai/api-keys/',
  },
  'x-ai': {
    value: 'xai',
    name: 'xAI',
    website: 'https://console.x.ai/',
  },
  'deepseek': {
    value: 'deepseek',
    name: 'DeepSeek',
    website: 'https://platform.deepseek.com/api_keys',
  },
  'cohere': {
    value: 'cohere',
    name: 'Cohere',
    website: 'https://dashboard.cohere.com/api-keys',
  },
  'meta': {
    value: 'meta',
    name: 'Meta',
  },
}

const PREVIEW_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

function isWithinPreviewWindow(releaseDate?: string): boolean {
  if (!releaseDate)
    return false

  const parsed = new Date(releaseDate)
  if (Number.isNaN(parsed.getTime()))
    return false

  const diff = Date.now() - parsed.getTime()
  return diff >= 0 && diff <= PREVIEW_WINDOW_MS
}

function resolveModelStatus(registryStatus?: Status, releaseDate?: string): Status {
  if (registryStatus)
    return registryStatus

  if (isWithinPreviewWindow(releaseDate))
    return 'preview'

  return 'all'
}

function getProviderValue(creatorSlug: string): string {
  return PROVIDER_MAP[creatorSlug]?.value ?? creatorSlug
}

function transformAAModel(aaModel: AAModel): Model {
  const provider = getProviderValue(aaModel.model_creator.slug)
  const value = aaModel.slug

  const registryEntry = getModelRegistry(provider, value)

  const baseName = aaModel.name ?? ''

  return {
    id: aaModel.id,
    value,
    provider,
    name: aaModel.name,
    alias: baseName.split('(')[0]?.trim(),

    capabilities: registryEntry?.capabilities,

    iq: scoreIq(aaModel.evaluations?.artificial_analysis_intelligence_index),
    speed: scoreSpeed(aaModel.median_output_tokens_per_second),

    metrics: {
      contextWindow: registryEntry?.contextWindow,
      intelligenceIndex: aaModel.evaluations?.artificial_analysis_intelligence_index,
      codingIndex: aaModel.evaluations?.artificial_analysis_coding_index,
      mathIndex: aaModel.evaluations?.artificial_analysis_math_index,
    },

    pricing: {
      input: aaModel.pricing?.price_1m_input_tokens,
      output: aaModel.pricing?.price_1m_output_tokens,
      blended: aaModel.pricing?.price_1m_blended_3_to_1,
    },

    releaseDate: aaModel.release_date,
    status: resolveModelStatus(registryEntry?.status, aaModel.release_date),
  }
}

function sortModels(models: Model[]): Model[] {
  return [...models].sort((a, b) => {
    if (a.provider === b.provider)
      return a.value.localeCompare(b.value)

    return a.provider.localeCompare(b.provider)
  })
}

function sortProviders(providers: Provider[]): Provider[] {
  return [...providers].sort((a, b) => a.name.localeCompare(b.name))
}

function toCanonicalManifest(providers: Provider[], models: Model[]): { providers: Provider[], models: Model[] } {
  const canonicalProviders = providers.map(provider => ({ ...provider }))
  const canonicalModels = models.map(model => ({
    ...model,
    capabilities: model.capabilities ? { ...model.capabilities } : undefined,
    metrics: model.metrics ? { ...model.metrics } : undefined,
    pricing: model.pricing ? { ...model.pricing } : undefined,
    config: model.config ? { ...model.config } : undefined,
  }))

  return {
    providers: sortProviders(canonicalProviders),
    models: sortModels(canonicalModels),
  }
}

async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(input)

  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('')
}

async function createManifestTags(providers: Provider[], models: Model[]): Promise<{ etag: string, version: string }> {
  const canonical = toCanonicalManifest(providers, models)
  const json = JSON.stringify(canonical)
  const fullHash = await sha256Hex(json)
  const shortHash = fullHash.slice(0, 32)

  return {
    etag: `"${shortHash}"`,
    version: `v1.${shortHash.slice(0, 12)}`,
  }
}

export async function fetchAndTransformManifest(apiKey: string): Promise<Manifest> {
  const response = await fetch('https://artificialanalysis.ai/api/v2/data/llms/models', {
    headers: {
      'x-api-key': apiKey,
    },
  })

  if (!response.ok)
    throw new Error(`Failed to fetch from Artificial Analysis: ${response.statusText}`)

  const aaData = await response.json() as AAResponse

  const aaModels = aaData.data.map(transformAAModel)

  const aaProviderSet = new Set<string>()
  aaModels.forEach(m => aaProviderSet.add(m.provider))

  const aaProviderList: Provider[] = Array.from(aaProviderSet)
    .map((value) => {
      const mapped = PROVIDER_MAP[value]
      return {
        value,
        name: mapped?.name ?? value,
        keyPlaceholder: mapped?.keyPlaceholder,
        website: mapped?.website,
        status: 'latest' as const,
      }
    })

  const { providers, models } = applyOverrides(aaProviderList, aaModels, {
    providers: OFFICIAL_PROVIDER_OVERRIDES,
    models: OFFICIAL_MODEL_OVERRIDES,
  })

  const sortedProviders = sortProviders(providers)
  const sortedModels = sortModels(models)

  const generatedAt = new Date().toISOString()
  const { etag, version } = await createManifestTags(sortedProviders, sortedModels)

  return {
    version,
    etag,
    generatedAt,
    providers: sortedProviders,
    models: sortedModels,
  }
}
