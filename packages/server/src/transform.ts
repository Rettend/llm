import type { AAModel, AAResponse, Manifest, Model, Provider } from '@rttnd/llm-shared'
import { Buffer } from 'node:buffer'
import { getModelCapabilities } from '@rttnd/llm-shared'
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

function getProviderValue(creatorSlug: string): string {
  return PROVIDER_MAP[creatorSlug]?.value ?? creatorSlug
}

function normalizeModelValue(aaModel: AAModel): string {
  // Extract model identifier from name or slug
  // TODO: This is a simple heuristic - you may need to refine this
  const name = (aaModel.name ?? '').toLowerCase()

  // Handle special cases
  if (name.includes('gpt-oss'))
    return name.split(' ')[0] || aaModel.slug // e.g., "gpt-oss-20b"
  if (name.includes('gpt-5'))
    return name.split(' ')[0] || aaModel.slug // e.g., "gpt-5"

  // Default to slug
  return aaModel.slug
}

function transformAAModel(aaModel: AAModel): Model {
  const provider = getProviderValue(aaModel.model_creator.slug)
  const value = normalizeModelValue(aaModel)

  const capabilitiesData = getModelCapabilities(provider, value)

  const baseName = aaModel.name ?? ''

  return {
    id: aaModel.id,
    value,
    provider,
    name: aaModel.name,
    alias: baseName.split('(')[0]?.trim(), // Remove parenthetical suffixes

    capabilities: capabilitiesData?.capabilities,

    iq: scoreIq(aaModel.evaluations?.artificial_analysis_intelligence_index),
    speed: scoreSpeed(aaModel.median_output_tokens_per_second),

    metrics: {
      contextWindow: capabilitiesData?.contextWindow,
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
    status: 'active',
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

  const models = aaData.data.map(transformAAModel)

  const providerSet = new Set<string>()
  models.forEach(m => providerSet.add(m.provider))

  const providers: Provider[] = Array.from(providerSet)
    .map((value) => {
      const mapped = PROVIDER_MAP[value]
      return {
        value,
        name: mapped?.name ?? value,
        keyPlaceholder: mapped?.keyPlaceholder,
        website: mapped?.website,
        status: 'active' as const,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  const generatedAt = new Date().toISOString()
  const version = `v1.${Date.now()}`
  const etag = `W/"${Buffer.from(version).toString('base64')}"`

  return {
    version,
    etag,
    generatedAt,
    providers,
    models,
  }
}
