/* eslint-disable no-console */
import type { Manifest, Model } from '../packages/shared/src/types'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { MODEL_CAPABILITIES } from '../packages/shared/src/capabilities'

/**
 * Compare curated MODEL_CAPABILITIES with the current manifest preview and
 * report which curated models are missing from the manifest along with
 * best-match AA slugs to consider as aliases.
 *
 * Usage: bun run report
 */

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function bestMatchesForProvider(
  provider: string,
  targetModel: string,
  manifestModels: Model[],
): Array<{ value: string, score: number }> {
  const target = normalize(targetModel)
  const candidates = manifestModels.filter(m => m.provider === provider)

  const scored = candidates.map((m) => {
    const v = normalize(m.value)
    if (v === target)
      return { value: m.value, score: 1 }

    const a = v.length
    const b = target.length
    const overlap = v.includes(target) || target.includes(v)
      ? Math.min(a, b) / Math.max(a, b)
      : 0
    return { value: m.value, score: overlap }
  })

  return scored
    .filter(s => s.score > 0.4)
    .sort((x, y) => y.score - x.score)
    .slice(0, 3)
}

function main() {
  const previewPath = join(process.cwd(), 'data', 'manifest-preview.json')
  let manifest: Manifest
  try {
    const raw = readFileSync(previewPath, 'utf8')
    manifest = JSON.parse(raw) as Manifest
  }
  catch {
    console.error(`❌ Could not read ${previewPath}. Run \`bun run seed\` first.`)
    process.exit(1)
  }

  const present = new Set<string>(
    manifest.models.map(m => `${m.provider}:${m.value}`),
  )

  interface Gap { provider: string, model: string, suggestions: Array<{ value: string, score: number }> }
  const gaps: Gap[] = []

  const providers = Object.keys(MODEL_CAPABILITIES)
  for (const provider of providers) {
    const models = Object.keys(MODEL_CAPABILITIES[provider] || {})
    for (const model of models) {
      const key = `${provider}:${model}`
      if (!present.has(key)) {
        const suggestions = bestMatchesForProvider(provider, model, manifest.models)
        gaps.push({ provider, model, suggestions })
      }
    }
  }

  const byProvider = new Map<string, Gap[]>()
  for (const gap of gaps) {
    if (!byProvider.has(gap.provider))
      byProvider.set(gap.provider, [])
    byProvider.get(gap.provider)!.push(gap)
  }

  console.log('🧭 Capability Sync Report (curated → manifest)')
  console.log('='.repeat(60))
  console.log(`Curated provider entries: ${providers.length}`)
  console.log(`Curated total models: ${providers.reduce((n, p) => n + Object.keys(MODEL_CAPABILITIES[p] || {}).length, 0)}`)
  console.log(`Missing in manifest: ${gaps.length}`)
  console.log()

  const sorted = Array.from(byProvider.entries()).sort((a, b) => b[1].length - a[1].length)
  for (const [provider, list] of sorted) {
    console.log(`\n${provider} (${list.length} missing):`)
    for (const item of list.slice(0, 10)) {
      const sugg = item.suggestions.map(s => `${s.value}${s.score === 1 ? ' (exact)' : ''}`).join(', ')
      if (sugg)
        console.log(`  - ${item.model}  →  ${sugg}`)
      else
        console.log(`  - ${item.model}`)
    }
    if (list.length > 10)
      console.log(`  ... and ${list.length - 10} more`)
  }

  const outPath = join(process.cwd(), 'data', 'capability-gaps.json')
  writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), gaps }, null, 2))
  console.log(`\n📝 Detailed gaps written to: ${outPath}`)
}

main()
