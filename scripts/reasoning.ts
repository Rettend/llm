/* eslint-disable no-console */
import fs from 'node:fs/promises'
import process from 'node:process'
import { MODEL_REGISTRY } from '@rttnd/llm-shared/registry'

const REGISTRY_PATH = 'packages/shared/src/registry.ts'
const REASONING_DATA_PATH = 'packages/shared/src/reasoning-data.ts'
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

interface ResolutionStats {
  exactHits: number
  uniqueHits: number
  normalizedHits: number
  fallbackHits: number
}

interface RegistryRecord {
  provider: string
  model: string
  base: string
  reasoning: boolean
  efforts: string[]
}

interface ReasoningGroupSpec {
  defaultModel: string
  model: string
  efforts?: string[]
}

interface ReasoningGroupData {
  groups: Map<string, ReasoningGroupSpec>
  modelToGroup: Map<string, string>
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

function deriveFamilyBase(modelID: string): string {
  return modelID
    .replace(/-non-reasoning(?:-low-effort)?$/i, '')
    .replace(/-thinking-preview$/i, '')
    .replace(/-reasoning-preview$/i, '')
    .replace(/-reasoning-(?:none|minimal|low|medium|high|max|xhigh)$/i, '')
    .replace(/-reasoning$/i, '')
    .replace(/-thinking$/i, '')
    .replace(/-adaptive$/i, '')
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

function extractBlock(source: string, anchor: string): { block: string } {
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

function resolveEffortsForRegistry(input: {
  lookup: EffortLookup
  variants: VariantsFn
}): { effortsByModel: Map<string, string[]>, stats: ResolutionStats } {
  const effortsByModel = new Map<string, string[]>()

  let exactHits = 0
  let uniqueHits = 0
  let normalizedHits = 0
  let fallbackHits = 0

  for (const [provider, models] of Object.entries(MODEL_REGISTRY)) {
    for (const [model, entry] of Object.entries(models ?? {})) {
      const resolution = getEffortsForRegistryModel({
        provider,
        model,
        supportsReasoning: Boolean(entry.capabilities?.reasoning),
        lookup: input.lookup,
        variants: input.variants,
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

  return {
    effortsByModel,
    stats: {
      exactHits,
      uniqueHits,
      normalizedHits,
      fallbackHits,
    },
  }
}

function buildRegistryRecords(effortsByModel: Map<string, string[]>): RegistryRecord[] {
  const records: RegistryRecord[] = []

  for (const [provider, models] of Object.entries(MODEL_REGISTRY)) {
    for (const [model, entry] of Object.entries(models ?? {})) {
      records.push({
        provider,
        model,
        base: deriveFamilyBase(model),
        reasoning: Boolean(entry.capabilities?.reasoning),
        efforts: effortsByModel.get(keyOf(provider, model)) ?? [],
      })
    }
  }

  return records
}

function pickDefaultModel(base: string, group: RegistryRecord[]): RegistryRecord {
  const sorted = [...group].sort((a, b) => a.model.localeCompare(b.model))
  const nonReasoning = sorted.filter(model => !model.reasoning)

  if (nonReasoning.length > 0)
    return nonReasoning.find(model => model.model === base) ?? nonReasoning[0]!

  return sorted.find(model => model.model === base) ?? sorted[0]!
}

function isGenericReasoningVariant(model: string): boolean {
  return /-(reasoning|thinking|adaptive)$/i.test(model)
    || /-(thinking|reasoning)-preview$/i.test(model)
}

function pickReasoningModel(base: string, group: RegistryRecord[]): RegistryRecord | undefined {
  const reasoningModels = group.filter(model => model.reasoning)
  if (reasoningModels.length === 0)
    return undefined

  const sorted = [...reasoningModels].sort((a, b) => {
    const effortDiff = effortScore(b.efforts) - effortScore(a.efforts)
    if (effortDiff !== 0)
      return effortDiff

    const aBase = a.model === base ? 1 : 0
    const bBase = b.model === base ? 1 : 0
    if (aBase !== bBase)
      return bBase - aBase

    const aGeneric = isGenericReasoningVariant(a.model) ? 1 : 0
    const bGeneric = isGenericReasoningVariant(b.model) ? 1 : 0
    if (aGeneric !== bGeneric)
      return bGeneric - aGeneric

    return a.model.localeCompare(b.model)
  })

  return sorted[0]
}

function buildGroupSpec(base: string, group: RegistryRecord[]): ReasoningGroupSpec | undefined {
  const defaultModel = pickDefaultModel(base, group)
  const reasoningModel = pickReasoningModel(base, group)
  if (!reasoningModel)
    return undefined

  const efforts = normalizeEfforts(reasoningModel.efforts.filter(effort => effort !== 'none'))

  if (efforts.length === 0 && reasoningModel.model === defaultModel.model)
    return undefined

  return {
    defaultModel: defaultModel.model,
    model: reasoningModel.model,
    efforts: efforts.length > 0 ? efforts : undefined,
  }
}

function buildReasoningGroupData(records: RegistryRecord[]): ReasoningGroupData {
  const groups = new Map<string, { provider: string, base: string, records: RegistryRecord[] }>()

  for (const record of records) {
    const groupKey = keyOf(record.provider, record.base)
    const group = groups.get(groupKey)

    if (group)
      group.records.push(record)
    else
      groups.set(groupKey, { provider: record.provider, base: record.base, records: [record] })
  }

  const specs = new Map<string, ReasoningGroupSpec>()
  const modelToGroup = new Map<string, string>()

  for (const [groupKey, group] of groups) {
    const spec = buildGroupSpec(group.base, group.records)
    if (!spec)
      continue

    specs.set(groupKey, spec)
    for (const record of group.records)
      modelToGroup.set(keyOf(group.provider, record.model), groupKey)
  }

  return {
    groups: specs,
    modelToGroup,
  }
}

function removeReasoningMetadata(body: string): string {
  return body
    .replace(/,\s*reasoningEfforts:\s*\[[^\]]*\]/g, '')
    .replace(/,\s*reasoningControl:\s*\{.*\}$/g, '')
    .replace(/^\s*reasoningEfforts:\s*\[[^\]]*\],\s*/g, '')
    .replace(/^\s*reasoningControl:\s*\{.*\},\s*/g, '')
    .replace(/^\s*reasoningEfforts:\s*\[[^\]]*\]\s*$/g, '')
    .replace(/^\s*reasoningControl:\s*\{.*\}\s*$/g, '')
    .trim()
}

function stripReasoningFromLine(line: string): { line: string, changed: boolean } {
  const match = line.match(/^(\s+'[^']+':\s*\{)\s*(.*?)\s*(\},?)\s*$/)
  if (!match)
    return { line, changed: false }

  const [, prefix, rawBody, suffix] = match
  const cleanedBody = removeReasoningMetadata(rawBody)
  if (cleanedBody === rawBody)
    return { line, changed: false }

  return {
    line: `${prefix} ${cleanedBody} ${suffix}`,
    changed: true,
  }
}

function cleanRegistrySource(source: string): { source: string, changedLines: number } {
  const lines = source.split('\n')
  let changedLines = 0

  for (let i = 0; i < lines.length; i++) {
    const next = stripReasoningFromLine(lines[i]!)
    if (!next.changed)
      continue

    lines[i] = next.line
    changedLines++
  }

  return {
    source: lines.join('\n'),
    changedLines,
  }
}

function toEffortLiteral(efforts: string[] | undefined): string {
  if (!efforts || efforts.length === 0)
    return 'undefined'

  return `[${efforts.map(effort => `'${effort}'`).join(', ')}]`
}

function generateReasoningDataSource(data: ReasoningGroupData): string {
  const groupEntries = Array.from(data.groups.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  const modelEntries = Array.from(data.modelToGroup.entries()).sort((a, b) => a[0].localeCompare(b[0]))

  const groupLines = groupEntries
    .map(([key, spec]) => {
      const efforts = toEffortLiteral(spec.efforts)
      return `  '${key}': { defaultModel: '${spec.defaultModel}', model: '${spec.model}', efforts: ${efforts} },`
    })
    .join('\n')

  const modelLines = modelEntries
    .map(([modelKey, groupKey]) => `  '${modelKey}': '${groupKey}',`)
    .join('\n')

  return `import type { ReasoningControl } from './types'

interface ReasoningGroupSpec {
  defaultModel: string
  model: string
  efforts: readonly string[] | undefined
}

const REASONING_GROUP_SPECS: Record<string, ReasoningGroupSpec> = {
${groupLines}
}

const MODEL_TO_REASONING_GROUP: Record<string, string> = {
${modelLines}
}

function keyOf(provider: string, model: string): string {
  return \`\${provider.toLowerCase()}:\${model.toLowerCase()}\`
}

function buildControl(spec: ReasoningGroupSpec): ReasoningControl {
  const options = [{ id: 'default', model: spec.defaultModel }] as ReasoningControl['options']

  if (spec.efforts && spec.efforts.length > 0) {
    for (const effort of spec.efforts) {
      options.push({
        id: effort,
        model: spec.model,
        effort,
      })
    }
  }
  else if (spec.model !== spec.defaultModel) {
    options.push({
      id: 'thinking',
      model: spec.model,
    })
  }

  return {
    default: 'default',
    options,
  }
}

export function getModelReasoningControl(provider: string, model: string): ReasoningControl | undefined {
  const modelKey = keyOf(provider, model)
  const groupKey = MODEL_TO_REASONING_GROUP[modelKey]
  if (!groupKey)
    return undefined

  const spec = REASONING_GROUP_SPECS[groupKey]
  if (!spec)
    return undefined

  return buildControl(spec)
}
`
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

async function main() {
  const rawArgs = process.argv.slice(2)
  const args = new Set(rawArgs)

  const dryRun = args.has('--dry-run') || args.has('-d')
  const pinnedSha = parseArgValue(rawArgs, '--sha', '-s')

  const ref = pinnedSha ?? OPENCODE_BRANCH
  const transformUrl = `https://raw.githubusercontent.com/${OPENCODE_REPO}/${ref}/packages/opencode/src/provider/transform.ts`
  const resolvedSha = pinnedSha ?? await resolveBranchSha(OPENCODE_BRANCH)

  console.log(`Fetching OpenCode transform.ts (${ref})`)
  const transformSource = await fetchText(transformUrl)

  if (resolvedSha)
    console.log(`Upstream SHA: ${resolvedSha.slice(0, 12)}`)

  console.log('Fetching models.dev provider catalog')
  const modelsDev = await fetchModelsDev()

  console.log('Building reasoning evaluator from transform.ts')
  const variants = buildVariantsEvaluator(transformSource)
  const lookup = buildLookup(modelsDev, variants)

  const resolution = resolveEffortsForRegistry({ lookup, variants })
  const records = buildRegistryRecords(resolution.effortsByModel)
  const groupData = buildReasoningGroupData(records)

  const registrySource = await fs.readFile(REGISTRY_PATH, 'utf8')
  const cleanedRegistry = cleanRegistrySource(registrySource)

  const nextReasoningData = generateReasoningDataSource(groupData)
  const currentReasoningData = await fs.readFile(REASONING_DATA_PATH, 'utf8').catch(() => '')
  const reasoningDataChanged = currentReasoningData !== nextReasoningData

  const toggleControls = Array.from(groupData.groups.values()).filter(spec => !spec.efforts || spec.efforts.length === 0).length
  const effortControls = Array.from(groupData.groups.values()).filter(spec => Boolean(spec.efforts && spec.efforts.length > 0)).length

  console.log()
  console.log('Reasoning resolution:')
  console.log(`  Exact matches: ${resolution.stats.exactHits}`)
  console.log(`  Unique model-id matches: ${resolution.stats.uniqueHits}`)
  console.log(`  Normalized model-id matches: ${resolution.stats.normalizedHits}`)
  console.log(`  Fallback evaluations: ${resolution.stats.fallbackHits}`)
  console.log(`  Reasoning groups: ${groupData.groups.size}`)
  console.log(`  Models with reasoning control: ${groupData.modelToGroup.size}`)
  console.log(`  Toggle controls: ${toggleControls}`)
  console.log(`  Effort controls: ${effortControls}`)

  console.log()
  if (cleanedRegistry.changedLines === 0 && !reasoningDataChanged) {
    console.log('registry and reasoning data are already up to date')
    return
  }

  console.log(`registry.ts cleaned lines: ${cleanedRegistry.changedLines}`)
  console.log(`reasoning-data.ts updated: ${reasoningDataChanged ? 'yes' : 'no'}`)

  if (dryRun) {
    console.log('dry run: no files written')
    return
  }

  if (cleanedRegistry.changedLines > 0)
    await fs.writeFile(REGISTRY_PATH, cleanedRegistry.source, 'utf8')

  if (reasoningDataChanged)
    await fs.writeFile(REASONING_DATA_PATH, nextReasoningData, 'utf8')

  console.log('updated reasoning metadata files')
}

main().catch((error) => {
  console.error('reasoning script failed:', error)
  process.exit(1)
})
