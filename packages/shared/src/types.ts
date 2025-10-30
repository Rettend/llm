export interface Provider {
  value: string // 'openai', 'anthropic', etc.
  name: string // 'OpenAI', 'Anthropic'
  keyPlaceholder?: string // 'sk-...', 'sk-ant-...'
  website?: string // to get the api key
  status?: 'active' | 'beta' | 'deprecated'
}

export interface Model {
  // Identity
  id: string // Original AA id
  value: string // Model string for AI SDK
  provider: string
  name: string // Display name
  alias?: string // Short name for dropdowns

  // Capabilities
  capabilities?: {
    text?: boolean
    vision?: boolean
    reasoning?: boolean
    toolUse?: boolean
    json?: boolean
    audio?: boolean
  }

  // Performance
  iq?: 0 | 1 | 2 | 3 | 4 | 5 // Derived from AA intelligence index
  speed?: 0 | 1 | 2 | 3 | 4 | 5 // Derived from AA output tokens/sec

  // Metrics
  metrics?: {
    contextWindow?: number // From capabilities mapping
    intelligenceIndex?: number
    codingIndex?: number
    mathIndex?: number
  }

  // Pricing (per 1M tokens)
  pricing?: {
    input?: number
    output?: number
    blended?: number // 3:1 ratio default
  }

  // Metadata
  releaseDate?: string
  status?: 'active' | 'beta' | 'deprecated'

  // AI SDK settings
  config?: {
    mode: 'auto' | 'json' | 'tool'  
  }
}

export interface Manifest {
  version: string
  etag: string
  generatedAt: string
  providers: Provider[]
  models: Model[]
}

// Artificial Analysis API response types
export interface AAModelCreator {
  id: string
  name: string
  slug: string
}

export interface AAEvaluations {
  artificial_analysis_intelligence_index?: number
  artificial_analysis_coding_index?: number
  artificial_analysis_math_index?: number
  mmlu_pro?: number
  gpqa?: number
  hle?: number
  livecodebench?: number
  scicode?: number
  math_500?: number | null
  aime?: number | null
  aime_25?: number
  ifbench?: number
  lcr?: number
  terminalbench_hard?: number
  tau2?: number
}

export interface AAPricing {
  price_1m_blended_3_to_1?: number
  price_1m_input_tokens?: number
  price_1m_output_tokens?: number
}

export interface AAModel {
  id: string
  name: string
  slug: string
  release_date?: string
  model_creator: AAModelCreator
  evaluations?: AAEvaluations
  pricing?: AAPricing
  median_output_tokens_per_second?: number
  median_time_to_first_token_seconds?: number
  median_time_to_first_answer_token?: number
}

export interface AAResponse {
  data: AAModel[]
}
