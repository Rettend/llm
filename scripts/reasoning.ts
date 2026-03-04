/* eslint-disable no-console */
import fs from 'node:fs/promises'
import process from 'node:process'
import { MODEL_REGISTRY } from '@rttnd/llm-shared/registry'

const REGISTRY_PATH = 'packages/shared/src/registry.ts'
const MODELS_DEV_URL = 'https://models.dev/api.json'
const OPENCODE_REPO = 'anomalyco/opencode'
const OPENCODE_BRANCH = 'dev'

const EFFORT_ORDER = ['none', 'minimal', 'low', 'medium', 'high', 'max', 'xhigh', 'thinking'] as const
const EFFORT_RANK = new Map<string, number>(EFFORT_ORDER.map((value, index) => [value, index]))

const PROVIDER_NPM_FALLBACK: Record<string, string> = {
  'openai': '@ai-sdk/openai',
  'azure': '@ai-sdk/azure',
  'anthropic': '@ai-sdk/anthropic',
  'google': '@ai-sdk/google',
  'aws': '@ai-sdk/amazon-bedrock',
  'xai': '@ai-sdk/xai',
  'mistral': '@ai-sdk/mistral',
  'groq': '@ai-sdk/groq',
  'cerebras': '@ai-sdk/cerebras',
  'cohere': '@ai-sdk/cohere',
  'perplexity': '@ai-sdk/perplexity',
}

interface ModelsDevModel {
  id?: string
  reasoning?: boolean
  release_date?: string
  limit?: {
    output?: number
  }
  provider?: {
    npm?: string
  }
}

interface ModelsDevProvider {
  id?: string
  npm?: string
  models?: Record<string, ModelsDevModel>
}

type ModelsDevData = Record<string, ModelsDevProvider>

interface RuntimeModel {
  id: string
  providerID: string
  api: {
    id: string
    npm: string
  }
  capabilities: {
    reasoning: boolean
  }
  limit: {
    output: number
  }
  release_date: string
}

type VariantsFn = (model: RuntimeModel) => Record<string, Record<string, unknown>>

interface EffortLookup {
  exact: Map<string, string[]>
  uniqueByModel: Map<string, string[]>
  uniqueByNormalizedModel: Map<string, string[]>
  releaseDateByModel: Map<string, string>
  releaseDateByNormalizedModel: Map<string, string>
}

interface ApplyResult {
  source: string
  touchedLines: number
  added: number
  updated: number
  removed: number
}

function parseArgValue(args: string[], name: string, short?: string): string | undefined {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!
    if (arg === name || (short && arg === short))
      return args[i + 1]
    if (arg.startsWith(`${name}=`))
      return arg.slice(name.length + 1)
  }
  return undefined
}

function normalizeEfforts(input: string[]): string[] {
  const deduped = Array.from(new Set(input.map(value => value.trim()).filter(Boolean)))

  return deduped.sort((a, b) => {
    const aRank = EFFORT_RANK.get(a)
    const bRank = EFFORT_RANK.get(b)

    if (aRank !== undefined && bRank !== undefined)
      return aRank - bRank
    if (aRank !== undefined)
      return -1
    if (bRank !== undefined)
      return 1
    return a.localeCompare(b)
  })
}

function keyOf(provider: string, model: string): string {
  return `${provider.toLowerCase()}:${model.toLowerCase()}`
}

function normalizeModelID(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function modelIDCandidates(modelID: string): string[] {
  const values = new Set<string>([modelID])
  const dotted = modelID.replace(/-(\d+)-(\d+)(?=-|$)/g, '-$1.$2')
  if (dotted !== modelID)
    values.add(dotted)
  return Array.from(values)
}

function effortScore(efforts: string[]): number {
  let score = efforts.length * 10
  if (efforts.includes('xhigh'))
    score += 4
  if (efforts.includes('max'))
    score += 3
  if (efforts.includes('minimal'))
    score += 2
  if (efforts.includes('none'))
    score += 1
  return score
}

function pickBestEfforts(candidates: string[][]): string[] {
  let best: string[] = []
  let bestScore = -1

  for (const efforts of candidates) {
    const score = effortScore(efforts)
    if (score > bestScore) {
      best = efforts
      bestScore = score
      continue
    }

    if (score === bestScore && efforts.join('|') < best.join('|'))
      best = efforts
  }

  return best
}

function extractBlock(source: string, anchor: string): { block: string, start: number, end: number } {
  const start = source.indexOf(anchor)
  if (start === -1)
    throw new Error(`Could not find anchor: ${anchor}`)

  const braceStart = source.indexOf('{', start)
  if (braceStart === -1)
    throw new Error(`Could not find opening brace for: ${anchor}`)

  let depth = 0
  for (let i = braceStart; i < source.length; i++) {
    const ch = source[i]
    if (ch === '{')
      depth++
    else if (ch === '}')
      depth--

    if (depth === 0) {
      return {
        block: source.slice(braceStart + 1, i),
        start,
        end: i + 1,
      }
    }
  }

  throw new Error(`Unbalanced braces while parsing block: ${anchor}`)
}

function buildVariantsEvaluator(transformSource: string): VariantsFn {
  const constantsStart = transformSource.indexOf('const WIDELY_SUPPORTED_EFFORTS')
  const variantsStart = transformSource.indexOf('export function variants(')

  if (constantsStart === -1)
    throw new Error('Could not find WIDELY_SUPPORTED_EFFORTS in transform.ts')
  if (variantsStart === -1)
    throw new Error('Could not find variants() in transform.ts')

  const constantsCode = transformSource.slice(constantsStart, variantsStart)
  const { block: variantsBody } = extractBlock(transformSource, 'export function variants(')

  const runtime = `${constantsCode}
const iife = (fn) => fn()
function variants(model) {${variantsBody}}
return variants
`

  const variants = new Function(runtime)() as unknown
  if (typeof variants !== 'function')
    throw new Error('Failed to compile variants() evaluator from transform.ts')

  return variants as VariantsFn
}

function getEfforts(variants: VariantsFn, model: RuntimeModel): string[] {
  try {
    const result = variants(model)
    if (!result || typeof result !== 'object')
      return []
    return normalizeEfforts(Object.keys(result))
  }
  catch {
    return []
  }
}

function toRuntimeModel(input: {
  providerID: string
  modelID: string
  npm: string
  reasoning: boolean
  outputLimit?: number
  releaseDate?: string
}): RuntimeModel {
  return {
    id: input.modelID,
    providerID: input.providerID,
    api: {
      id: input.modelID,
      npm: input.npm,
    },
    capabilities: {
      reasoning: input.reasoning,
    },
    limit: {
      output: input.outputLimit ?? 32_000,
    },
    release_date: input.releaseDate ?? '',
  }
}

function encodeEffortSet(efforts: string[]): string {
  return efforts.join('|')
}

function decodeEffortSet(encoded: string): string[] {
  return encoded.length > 0 ? encoded.split('|') : []
}

function buildLookup(modelsDev: ModelsDevData, variants: VariantsFn): EffortLookup {
  const exact = new Map<string, string[]>()
  const byModelCandidates = new Map<string, Set<string>>()
  const byNormalizedModelCandidates = new Map<string, Set<string>>()
  const releaseDateCandidates = new Map<string, Set<string>>()
  const releaseDateByNormalizedCandidates = new Map<string, Set<string>>()

  for (const [providerKey, provider] of Object.entries(modelsDev)) {
    const providerID = provider.id ?? providerKey
    const providerNpm = provider.npm ?? '@ai-sdk/openai-compatible'
    const models = provider.models ?? {}

    for (const [modelKey, model] of Object.entries(models)) {
      const modelID = model.id ?? modelKey
      const npm = model.provider?.npm ?? providerNpm
      const runtimeModel = toRuntimeModel({
        providerID,
        modelID,
        npm,
        reasoning: Boolean(model.reasoning),
        outputLimit: model.limit?.output,
        releaseDate: model.release_date,
      })

      const efforts = getEfforts(variants, runtimeModel)

      if (efforts.length > 0) {
        exact.set(keyOf(providerID, modelID), efforts)

        const modelLookupKey = modelID.toLowerCase()
        const candidateSet = byModelCandidates.get(modelLookupKey) ?? new Set<string>()
        candidateSet.add(encodeEffortSet(efforts))
        byModelCandidates.set(modelLookupKey, candidateSet)

        const normalizedLookupKey = normalizeModelID(modelID)
        const normalizedSet = byNormalizedModelCandidates.get(normalizedLookupKey) ?? new Set<string>()
        normalizedSet.add(encodeEffortSet(efforts))
        byNormalizedModelCandidates.set(normalizedLookupKey, normalizedSet)
      }

      if (model.release_date) {
        const modelLookupKey = modelID.toLowerCase()
        const dates = releaseDateCandidates.get(modelLookupKey) ?? new Set<string>()
        dates.add(model.release_date)
        releaseDateCandidates.set(modelLookupKey, dates)

        const normalizedLookupKey = normalizeModelID(modelID)
        const normalizedDates = releaseDateByNormalizedCandidates.get(normalizedLookupKey) ?? new Set<string>()
        normalizedDates.add(model.release_date)
        releaseDateByNormalizedCandidates.set(normalizedLookupKey, normalizedDates)
      }
    }
  }

  const uniqueByModel = new Map<string, string[]>()
  for (const [modelID, candidateSets] of byModelCandidates) {
    if (candidateSets.size === 1)
      uniqueByModel.set(modelID, decodeEffortSet(Array.from(candidateSets)[0]!))
  }

  const uniqueByNormalizedModel = new Map<string, string[]>()
  for (const [modelID, candidateSets] of byNormalizedModelCandidates) {
    if (candidateSets.size === 1)
      uniqueByNormalizedModel.set(modelID, decodeEffortSet(Array.from(candidateSets)[0]!))
  }

  const releaseDateByModel = new Map<string, string>()
  for (const [modelID, candidateDates] of releaseDateCandidates) {
    if (candidateDates.size === 1)
      releaseDateByModel.set(modelID, Array.from(candidateDates)[0]!)
  }

  const releaseDateByNormalizedModel = new Map<string, string>()
  for (const [modelID, candidateDates] of releaseDateByNormalizedCandidates) {
    if (candidateDates.size === 1)
      releaseDateByNormalizedModel.set(modelID, Array.from(candidateDates)[0]!)
  }

  return {
    exact,
    uniqueByModel,
    uniqueByNormalizedModel,
    releaseDateByModel,
    releaseDateByNormalizedModel,
  }
}

function removeReasoningEffortsProperty(body: string): string {
  return body
    .replace(/,\s*reasoningEfforts:\s*\[[^\]]*\]/g, '')
    .replace(/^\s*reasoningEfforts:\s*\[[^\]]*\],\s*/g, '')
    .replace(/^\s*reasoningEfforts:\s*\[[^\]]*\]\s*$/g, '')
    .trim()
}

function replaceReasoningEfforts(line: string, efforts: string[]): { line: string, had: boolean, has: boolean } {
  const match = line.match(/^(\s+'[^']+':\s*\{)\s*(.*?)\s*(\},?)\s*$/)
  if (!match)
    return { line, had: false, has: false }

  const [, prefix, rawBody, suffix] = match
  const had = /\breasoningEfforts:\s*\[/.test(rawBody)

  const cleanedBody = removeReasoningEffortsProperty(rawBody)
  const effortsLiteral = efforts.length > 0
    ? `reasoningEfforts: [${efforts.map(value => `'${value}'`).join(', ')}]`
    : ''

  const nextBody = effortsLiteral
    ? (cleanedBody.length > 0 ? `${cleanedBody}, ${effortsLiteral}` : effortsLiteral)
    : cleanedBody

  const nextLine = `${prefix} ${nextBody} ${suffix}`
  return {
    line: nextLine,
    had,
    has: efforts.length > 0,
  }
}

function applyRegistryUpdates(source: string, effortsByModel: Map<string, string[]>): ApplyResult {
  const lines = source.split('\n')
  let currentProvider: string | null = null

  let touchedLines = 0
  let added = 0
  let updated = 0
  let removed = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!

    const providerMatch = line.match(/^\s+'([^']+)':\s*\{$/)
    if (providerMatch) {
      currentProvider = providerMatch[1]!
      continue
    }

    if (line.match(/^\s+\},?\s*$/) && currentProvider && !line.includes('contextWindow')) {
      currentProvider = null
      continue
    }

    if (!currentProvider)
      continue

    const modelMatch = line.match(/^\s+'([^']+)':\s*\{.*\},?\s*$/)
    if (!modelMatch)
      continue

    const model = modelMatch[1]!
    const efforts = effortsByModel.get(keyOf(currentProvider, model)) ?? []

    const replaced = replaceReasoningEfforts(line, efforts)
    if (replaced.line === line)
      continue

    touchedLines++
    if (!replaced.had && replaced.has)
      added++
    else if (replaced.had && !replaced.has)
      removed++
    else
      updated++

    lines[i] = replaced.line
  }

  return {
    source: lines.join('\n'),
    touchedLines,
    added,
    updated,
    removed,
  }
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'llm-registry-reasoning-script',
    },
  })

  if (!response.ok)
    throw new Error(`Failed to fetch ${url} (HTTP ${response.status})`)

  return response.text()
}

async function fetchModelsDev(): Promise<ModelsDevData> {
  const response = await fetch(MODELS_DEV_URL)
  if (!response.ok)
    throw new Error(`Failed to fetch models.dev data (HTTP ${response.status})`)

  const data = await response.json() as unknown
  if (!data || typeof data !== 'object')
    throw new Error('models.dev response is not an object')

  return data as ModelsDevData
}

async function resolveBranchSha(branch: string): Promise<string | null> {
  const url = `https://api.github.com/repos/${OPENCODE_REPO}/commits/${branch}`
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'llm-registry-reasoning-script',
      'Accept': 'application/vnd.github+json',
    },
  })

  if (!response.ok)
    return null

  const payload = await response.json() as { sha?: unknown }
  return typeof payload.sha === 'string' ? payload.sha : null
}

function getEffortsForRegistryModel(input: {
  provider: string
  model: string
  supportsReasoning: boolean
  lookup: EffortLookup
  variants: VariantsFn
}): { efforts: string[], source: 'exact' | 'unique' | 'normalized' | 'fallback' | 'none' } {
  const { provider, model, supportsReasoning, lookup, variants } = input
  if (!supportsReasoning)
    return { efforts: [], source: 'none' }

  const candidates = modelIDCandidates(model)

  const exactMatches: string[][] = []
  for (const candidate of candidates) {
    const exactHit = lookup.exact.get(keyOf(provider, candidate))
    if (exactHit)
      exactMatches.push(exactHit)
  }
  if (exactMatches.length > 0)
    return { efforts: pickBestEfforts(exactMatches), source: 'exact' }

  const uniqueMatches: string[][] = []
  for (const candidate of candidates) {
    const uniqueHit = lookup.uniqueByModel.get(candidate.toLowerCase())
    if (uniqueHit)
      uniqueMatches.push(uniqueHit)
  }
  if (uniqueMatches.length > 0)
    return { efforts: pickBestEfforts(uniqueMatches), source: 'unique' }

  const normalizedMatches: string[][] = []
  for (const candidate of candidates) {
    const normalizedHit = lookup.uniqueByNormalizedModel.get(normalizeModelID(candidate))
    if (normalizedHit)
      normalizedMatches.push(normalizedHit)
  }
  if (normalizedMatches.length > 0)
    return { efforts: pickBestEfforts(normalizedMatches), source: 'normalized' }

  const npm = PROVIDER_NPM_FALLBACK[provider] ?? '@ai-sdk/openai-compatible'
  const fallbackMatches: string[][] = []
  for (const candidate of candidates) {
    const modelLookupKey = candidate.toLowerCase()
    const normalizedModelLookupKey = normalizeModelID(candidate)

    const runtimeModel = toRuntimeModel({
      providerID: provider,
      modelID: candidate,
      npm,
      reasoning: true,
      releaseDate: lookup.releaseDateByModel.get(modelLookupKey) ?? lookup.releaseDateByNormalizedModel.get(normalizedModelLookupKey),
    })

    const efforts = getEfforts(variants, runtimeModel)
    if (efforts.length > 0)
      fallbackMatches.push(efforts)
  }

  return {
    efforts: pickBestEfforts(fallbackMatches),
    source: 'fallback',
  }
}

async function main() {
  const rawArgs = process.argv.slice(2)
  const args = new Set(rawArgs)

  const dryRun = args.has('--dry-run') || args.has('-d')
  const pinnedSha = parseArgValue(rawArgs, '--sha', '-s')

  const ref = pinnedSha ?? OPENCODE_BRANCH
  const transformUrl = `https://raw.githubusercontent.com/${OPENCODE_REPO}/${ref}/packages/opencode/src/provider/transform.ts`
  const resolvedSha = pinnedSha ?? await resolveBranchSha(OPENCODE_BRANCH)

  console.log(`📦 Fetching OpenCode transform.ts (${ref})`)
  const transformSource = await fetchText(transformUrl)

  if (resolvedSha)
    console.log(`   Upstream SHA: ${resolvedSha.slice(0, 12)}`)

  console.log('📦 Fetching models.dev provider catalog')
  const modelsDev = await fetchModelsDev()

  console.log('🧠 Building reasoning evaluator from transform.ts')
  const variants = buildVariantsEvaluator(transformSource)
  const lookup = buildLookup(modelsDev, variants)

  let exactHits = 0
  let uniqueHits = 0
  let normalizedHits = 0
  let fallbackHits = 0

  const effortsByModel = new Map<string, string[]>()

  for (const [provider, models] of Object.entries(MODEL_REGISTRY)) {
    for (const [model, entry] of Object.entries(models ?? {})) {
      const resolution = getEffortsForRegistryModel({
        provider,
        model,
        supportsReasoning: Boolean(entry.capabilities?.reasoning),
        lookup,
        variants,
      })

      if (resolution.source === 'exact')
        exactHits++
      else if (resolution.source === 'unique')
        uniqueHits++
      else if (resolution.source === 'normalized')
        normalizedHits++
      else if (resolution.source === 'fallback')
        fallbackHits++

      effortsByModel.set(keyOf(provider, model), resolution.efforts)
    }
  }

  const source = await fs.readFile(REGISTRY_PATH, 'utf8')
  const result = applyRegistryUpdates(source, effortsByModel)

  const modelsWithEfforts = Array.from(effortsByModel.values()).filter(efforts => efforts.length > 0).length

  console.log()
  console.log('📊 Reasoning effort resolution:')
  console.log(`   Models with reasoning options: ${modelsWithEfforts}`)
  console.log(`   Exact matches: ${exactHits}`)
  console.log(`   Unique model-id matches: ${uniqueHits}`)
  console.log(`   Normalized model-id matches: ${normalizedHits}`)
  console.log(`   Fallback evaluations: ${fallbackHits}`)

  console.log()
  if (result.touchedLines === 0) {
    console.log('✅ registry.ts already up to date.')
    return
  }

  console.log(`✏️  Updated ${result.touchedLines} registry entries`)
  console.log(`   Added reasoningEfforts: ${result.added}`)
  console.log(`   Updated reasoningEfforts: ${result.updated}`)
  console.log(`   Removed reasoningEfforts: ${result.removed}`)

  if (dryRun) {
    console.log('🔍 Dry run: no files written.')
    return
  }

  await fs.writeFile(REGISTRY_PATH, result.source, 'utf8')
  console.log(`✅ Wrote updates to ${REGISTRY_PATH}`)
}

main().catch((error) => {
  console.error('❌ reasoning script failed:', error)
  process.exit(1)
})
