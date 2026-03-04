/* eslint-disable no-console */
import fs from 'node:fs/promises'
import process from 'node:process'

const REGISTRY_PATH = 'packages/shared/src/registry.ts'
const AA_BASE_URL = 'https://artificialanalysis.ai/models'

// Pattern that report.ts --write inserts for new models
const PLACEHOLDER_RE = /^\s+'([^']+)':\s*\{\s*contextWindow:\s*100_000,\s*capabilities:\s*_\(text\)\s*\},?\s*$/

// URL slug overrides: registry model name -> AA slug
// These handle cases where the AA URL slug differs from the registry key
const SLUG_OVERRIDES: Record<string, string | null> = {
  'gemini-3-1-pro-preview': 'gemini-3-1-pro-preview',
  'model-router': null, // Azure meta-model, not on AA
}

interface ModelData {
  contextWindow: number | null
  reasoning: boolean | null
  inputModalities: string[]
}

/**
 * Find placeholder entries and the provider they belong to.
 */
function findPlaceholders(source: string): { provider: string, model: string, line: number }[] {
  const lines = source.split('\n')
  const results: { provider: string, model: string, line: number }[] = []
  let currentProvider: string | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!

    // Match provider blocks: '  'providerName': {'
    const providerMatch = line.match(/^\s+'([^']+)':\s*\{$/)
    if (providerMatch)
      currentProvider = providerMatch[1]!

    // Match closing of provider block
    if (line.match(/^\s+\},?$/) && currentProvider && !line.match(/contextWindow/))
      currentProvider = null

    // Match placeholder entries
    const placeholderMatch = line.match(PLACEHOLDER_RE)
    if (placeholderMatch && currentProvider) {
      results.push({
        provider: currentProvider,
        model: placeholderMatch[1]!,
        line: i,
      })
    }
  }

  return results
}

/**
 * Determine the AA slug for a given provider/model combination.
 * Variants like -adaptive, -non-reasoning, -low-effort share a base model page.
 */
function getBaseSlug(model: string): { slug: string, isNonReasoning: boolean, isAdaptive: boolean } | null {
  const isNonReasoning = model.includes('non-reasoning')
  const isAdaptive = model.includes('adaptive')

  // Check explicit overrides first
  if (model in SLUG_OVERRIDES) {
    const override = SLUG_OVERRIDES[model]!
    if (override === null)
      return null // skip this model
    return { slug: override, isNonReasoning, isAdaptive }
  }

  // Strip variant suffixes to get the base model slug
  let slug = model
    .replace(/-non-reasoning(?:-low-effort)?$/, '')
    .replace(/-adaptive$/, '')

  // azure models use dots in names but AA uses hyphens
  if (slug.includes('.'))
    slug = slug.replace(/\./g, '-')

  // AA URLs are always lowercase
  slug = slug.toLowerCase()

  return { slug, isNonReasoning, isAdaptive }
}

/**
 * Fetch a model page from Artificial Analysis and extract data from the HTML.
 */
async function fetchModelData(slug: string): Promise<ModelData | null> {
  const url = `${AA_BASE_URL}/${slug}`
  console.error(`  📡 ${url}`)

  try {
    const resp = await fetch(url)
    if (!resp.ok) {
      console.error(`     ❌ HTTP ${resp.status}`)
      return null
    }

    const html = await resp.text()
    return extractFromHtml(html)
  }
  catch (err) {
    console.error(`     ❌ ${err}`)
    return null
  }
}

function extractFromHtml(html: string): ModelData {
  const result: ModelData = { contextWindow: null, reasoning: null, inputModalities: [] }

  // Context window: "context window of 400k tokens" or "context window of 1.0M tokens"
  const ctxMatch = html.match(/context window of ([\d,.]+)(?:\s*(k|M))?\s+tokens/i)
  if (ctxMatch) {
    let num = Number.parseFloat(ctxMatch[1]!.replace(/,/g, ''))
    const suffix = (ctxMatch[2] || '').toLowerCase()
    if (suffix === 'k')
      num *= 1000
    else if (suffix === 'm')
      num *= 1_000_000
    result.contextWindow = num
  }

  // Reasoning: count occurrences to distinguish question from answer
  // The FAQ has both "Is X a reasoning model?" and the answer "Yes/No, X is/is not a reasoning model."
  // If there are more "is a reasoning model" than "is not a reasoning model", it's a reasoner

  const notCount = (html.match(/is not a reasoning model/g) || []).length
  const yesCount = (html.match(/is a reasoning model/g) || []).length
  // The FAQ has both the question and answer; "Yes, X is a reasoning model" adds one extra
  if (yesCount > notCount)
    result.reasoning = true
  else if (notCount > 0)
    result.reasoning = false

  // Input modalities: "supports text and image input" / "supports text, image, and video input"
  const modalMatch = html.match(/supports ([\w, ]+?) input/i)
  if (modalMatch) {
    const modStr = modalMatch[1]!.toLowerCase()
    result.inputModalities = modStr
      .split(/[, ]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0 && s !== 'and')
  }

  return result
}

function formatNumber(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '_')
}

function buildCapabilitiesStr(data: ModelData, isNonReasoning: boolean, isAdaptive: boolean): string {
  const caps: string[] = ['text']

  if (data.inputModalities.includes('image'))
    caps.push('vision')
  if (data.inputModalities.includes('speech') || data.inputModalities.includes('audio'))
    caps.push('audio')

  // adaptive = can reason, non-reasoning = cannot
  if (isAdaptive || (data.reasoning && !isNonReasoning))
    caps.push('reasoning')

  return caps.join(', ')
}

async function main() {
  const args = new Set(process.argv.slice(2))
  const dryRun = args.has('--dry-run') || args.has('-d')

  let source = await fs.readFile(REGISTRY_PATH, 'utf8')
  const placeholders = findPlaceholders(source)

  if (!placeholders.length) {
    console.log('✅ No placeholder entries found in registry.')
    return
  }

  console.log(`🔍 Found ${placeholders.length} placeholder entries:`)
  for (const p of placeholders)
    console.log(`   ${p.provider}/${p.model}`)
  console.log()

  // Group by base slug to avoid duplicate fetches
  const slugCache = new Map<string, ModelData | null>()

  let updated = 0
  let failed = 0

  for (const placeholder of placeholders) {
    const baseSlug = getBaseSlug(placeholder.model)

    // Skip models that have no AA page
    if (!baseSlug) {
      console.log(`   ⏭️  ${placeholder.model} — no AA page (skipped)`)
      continue
    }

    const { slug, isNonReasoning, isAdaptive } = baseSlug

    // Fetch base model data (cached)
    if (!slugCache.has(slug)) {
      const data = await fetchModelData(slug)
      slugCache.set(slug, data)
    }

    const data = slugCache.get(slug)
    if (!data || data.contextWindow === null) {
      console.error(`   ⚠️  No data for ${placeholder.provider}/${placeholder.model} (slug: ${slug})`)
      failed++
      continue
    }

    const ctxStr = formatNumber(data.contextWindow)
    const capsStr = buildCapabilitiesStr(data, isNonReasoning, isAdaptive)
    const newLine = `    '${placeholder.model}': { contextWindow: ${ctxStr}, capabilities: _(${capsStr}) },`
    const oldLine = source.split('\n')[placeholder.line]!

    if (oldLine.trim() === newLine.trim()) {
      console.log(`   ⏭️  ${placeholder.model} — already up to date`)
      continue
    }

    console.log(`   ✏️  ${placeholder.model}: ${ctxStr} ctx, [${capsStr}]`)

    // Replace the line in source
    const lines = source.split('\n')
    lines[placeholder.line] = newLine
    source = lines.join('\n')
    updated++
  }

  if (updated > 0 && !dryRun) {
    await fs.writeFile(REGISTRY_PATH, source, 'utf8')
    console.log()
    console.log(`✅ Updated ${updated} entries in ${REGISTRY_PATH}`)
  }
  else if (updated > 0 && dryRun) {
    console.log()
    console.log(`🔍 Dry run: would update ${updated} entries in ${REGISTRY_PATH}`)
  }
  else {
    console.log()
    console.log('✅ No updates needed.')
  }

  if (failed > 0)
    console.log(`⚠️  ${failed} entries could not be fetched — check slugs or AA availability`)
}

main().catch((error) => {
  console.error('❌ fetch script failed:', error)
  process.exit(1)
})
