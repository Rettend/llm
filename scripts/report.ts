/* eslint-disable no-console */
import fs from 'node:fs/promises'
import process from 'node:process'
import { MODEL_REGISTRY } from '@rttnd/llm-shared/registry'

interface PublicModel {
  provider: string
  value: string
  name?: string
  status?: string
}

const CURRENT_MODELS_PATH = 'public/models.json'
const BASELINE_MODELS_PATH = 'public/models.baseline.json'

async function fileExists(path: string): Promise<boolean> {
  try {
    await fs.access(path)
    return true
  }
  catch {
    return false
  }
}

async function loadModels(path: string): Promise<PublicModel[]> {
  const raw = await fs.readFile(path, 'utf8')
  const data = JSON.parse(raw) as unknown
  if (!Array.isArray(data))
    throw new Error(`Expected array in ${path}`)
  return data as PublicModel[]
}

function keyOf(model: PublicModel): string {
  return `${model.provider}:${model.value}`
}

function getRegistryKeys(): string[] {
  const keys: string[] = []

  for (const [provider, models] of Object.entries(MODEL_REGISTRY)) {
    if (!models)
      continue
    for (const modelValue of Object.keys(models))
      keys.push(`${provider}:${modelValue}`)
  }

  return keys
}

async function diffModels(options: { showMissingFromRegistry?: boolean } = {}) {
  const { showMissingFromRegistry = false } = options
  const hasCurrent = await fileExists(CURRENT_MODELS_PATH)
  if (!hasCurrent) {
    console.error(`❌ ${CURRENT_MODELS_PATH} not found. Make sure you've pulled the latest public data.`)
    process.exit(1)
  }

  const currentModels = await loadModels(CURRENT_MODELS_PATH)
  const baselineExists = await fileExists(BASELINE_MODELS_PATH)
  const baselineModels = baselineExists ? await loadModels(BASELINE_MODELS_PATH) : []

  const currentMap = new Map<string, PublicModel>()
  for (const model of currentModels)
    currentMap.set(keyOf(model), model)

  const baselineMap = new Map<string, PublicModel>()
  for (const model of baselineModels)
    baselineMap.set(keyOf(model), model)

  const currentKeys = new Set(currentMap.keys())
  const baselineKeys = new Set(baselineMap.keys())

  const newKeys: string[] = []
  const removedKeys: string[] = []

  for (const key of currentKeys) {
    if (!baselineKeys.has(key))
      newKeys.push(key)
  }

  for (const key of baselineKeys) {
    if (!currentKeys.has(key))
      removedKeys.push(key)
  }

  const missingFromCurrent: string[] = []
  if (showMissingFromRegistry) {
    const registryKeys = getRegistryKeys()
    for (const key of registryKeys) {
      if (!currentKeys.has(key))
        missingFromCurrent.push(key)
    }
  }

  console.log('🧾 Model changelog (current public data vs curated baseline)')
  console.log()
  if (!baselineExists) {
    console.log(`ℹ️ No baseline file found at ${BASELINE_MODELS_PATH}.`)
    console.log('   Treating baseline as empty; all current models are considered “new”.')
    console.log('   Once you are happy with the curated registry, run this script with --update-baseline.')
    console.log()
  }

  console.log(`Current models:  ${currentModels.length}`)
  console.log(`Baseline models: ${baselineModels.length}`)
  console.log(`New models:      ${newKeys.length}`)
  console.log(`Removed models:  ${removedKeys.length}`)
  console.log()

  if (!newKeys.length && !removedKeys.length && !missingFromCurrent.length) {
    console.log('✅ No changes since the last baseline.')
    return
  }

  if (newKeys.length) {
    console.log('📥 New models since baseline:')
    for (const key of newKeys) {
      const model = currentMap.get(key)!
      const displayName = model.name ? ` — ${model.name}` : ''
      console.log(`- ${model.provider}/${model.value}${displayName}`)
    }
    console.log()

    console.log('🔧 Registry snippet templates (per model, paste into `packages/shared/src/registry.ts`):')
    console.log()
    for (const key of newKeys) {
      const model = currentMap.get(key)!
      const displayName = model.name ? ` — ${model.name}` : ''
      console.log(`// ${model.provider}/${model.value}${displayName}`)
      console.log(`'${model.value}': {`)
      console.log(`  status: 'active', // TODO: active | beta | deprecated`)
      console.log('  contextWindow: 128_000, // TODO: fill in from provider docs')
      console.log('  capabilities: _(text), // TODO: add vision/reasoning/toolUse/json/audio as needed')
      console.log('},')
      console.log()
    }
  }

  if (removedKeys.length) {
    console.log('📤 Models present in baseline but missing from current public data:')
    for (const key of removedKeys) {
      const model = baselineMap.get(key)!
      const displayName = model.name ? ` — ${model.name}` : ''
      console.log(`- ${model.provider}/${model.value}${displayName}`)
    }
    console.log()
  }

  if (showMissingFromRegistry && missingFromCurrent.length) {
    console.log('❓ Registry entries missing from current public models.json:')
    for (const key of missingFromCurrent) {
      const [provider, value] = key.split(':')
      const providerRegistry = MODEL_REGISTRY[provider as keyof typeof MODEL_REGISTRY]
      const registryEntry = providerRegistry && typeof providerRegistry === 'object'
        ? providerRegistry[value as keyof typeof providerRegistry]
        : undefined
      const status = registryEntry?.status ?? 'unknown'
      console.log(`- ${provider}/${value} (status: ${status})`)
    }
    console.log()
  }
}

async function updateBaseline() {
  const hasCurrent = await fileExists(CURRENT_MODELS_PATH)
  if (!hasCurrent) {
    console.error(`❌ ${CURRENT_MODELS_PATH} not found. Make sure you've pulled the latest public data.`)
    process.exit(1)
  }

  const currentModels = await loadModels(CURRENT_MODELS_PATH)
  const lines: string[] = []
  lines.push('[')

  currentModels.forEach((model, index) => {
    const json = JSON.stringify(model)
    const isLast = index === currentModels.length - 1
    lines.push(`  ${json}${isLast ? '' : ','}`)
  })

  lines.push(']')
  lines.push('')

  await fs.writeFile(BASELINE_MODELS_PATH, lines.join('\n'), 'utf8')

  console.log(`✅ Baseline updated: ${BASELINE_MODELS_PATH}`)
  console.log(`   Models recorded: ${currentModels.length}`)
}

async function main() {
  const args = new Set(process.argv.slice(2))
  const shouldUpdateBaseline = args.has('--update-baseline') || args.has('-u')
  const showMissingFromRegistry = args.has('--missing-from-registry') || args.has('-m')

  if (shouldUpdateBaseline)
    await updateBaseline()
  else
    await diffModels({ showMissingFromRegistry })
}

main().catch((error) => {
  console.error('❌ report script failed:', error)
  process.exit(1)
})
