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

async function diffModels(options: { showMissingFromRegistry?: boolean, writeToRegistry?: boolean } = {}) {
  const { showMissingFromRegistry = false, writeToRegistry = false } = options
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

  if (newKeys.length && !writeToRegistry) {
    console.log('📥 New models since baseline:')
    for (const key of newKeys) {
      const model = currentMap.get(key)!
      const displayName = model.name ? ` — ${model.name}` : ''
      console.log(`- ${model.provider}/${model.value}${displayName}`)
    }
  }

  if (newKeys.length && writeToRegistry) {
    const registryPath = 'packages/shared/src/registry.ts'
    const registrySource = await fs.readFile(registryPath, 'utf8')

    const insertionTarget = 'export const MODEL_REGISTRY = defineModelRegistry({'
    const insertionIndex = registrySource.indexOf(insertionTarget)
    if (insertionIndex === -1)
      throw new Error(`Could not find MODEL_REGISTRY definition in ${registryPath}`)

    const before = registrySource.slice(0, insertionIndex + insertionTarget.length)
    const after = registrySource.slice(insertionIndex + insertionTarget.length)

    const providerGroups = new Map<string, PublicModel[]>()
    for (const key of newKeys) {
      const model = currentMap.get(key)!
      const list = providerGroups.get(model.provider) ?? []
      list.push(model)
      providerGroups.set(model.provider, list)
    }

    const lines: string[] = []
    lines.push(before)

    const indentProvider = '  '
    const indentModel = '    '

    const closeIndex = after.lastIndexOf('})')
    if (closeIndex === -1)
      throw new Error(`Could not locate closing of MODEL_REGISTRY in ${registryPath}`)

    let bodyBeforeClose = after.slice(0, closeIndex)
    const bodyAfterClose = after.slice(closeIndex)

    // Now append new entries (merge into existing providers when possible)
    for (const [provider, models] of providerGroups) {
      const providerKey = `\n  '${provider}': {\n`
      const providerIndex = bodyBeforeClose.indexOf(providerKey)

      if (providerIndex !== -1) {
        // Provider already exists: insert models before its closing `  },`
        const providerBlockEnd = bodyBeforeClose.indexOf('\n  },', providerIndex)
        if (providerBlockEnd === -1)
          continue

        const beforeProviderClose = bodyBeforeClose.slice(0, providerBlockEnd)
        const afterProviderClose = bodyBeforeClose.slice(providerBlockEnd)

        const providerLines: string[] = []
        providerLines.push(beforeProviderClose)
        for (const model of models) {
          providerLines.push(`\n${indentModel}'${model.value}': {`)
          providerLines.push(`${indentModel}  contextWindow: 100_000,`)
          providerLines.push(`${indentModel}  capabilities: _(text),`)
          providerLines.push(`${indentModel}},`)
        }
        providerLines.push(afterProviderClose)

        bodyBeforeClose = providerLines.join('')
      }
      else {
        // New provider: append a fresh block before the final close.
        const providerLines: string[] = []
        providerLines.push(`\n${indentProvider}'${provider}': {`)
        for (const model of models) {
          providerLines.push(`\n${indentModel}'${model.value}': {`)
          providerLines.push(`${indentModel}  contextWindow: 100_000,`)
          providerLines.push(`${indentModel}  capabilities: _(text),`)
          providerLines.push(`${indentModel}},`)
        }
        providerLines.push(`\n${indentProvider}},`)

        bodyBeforeClose += providerLines.join('')
      }
    }

    lines.push(bodyBeforeClose)
    lines.push(bodyAfterClose)

    await fs.writeFile(registryPath, lines.join(''), 'utf8')

    console.log(`✏️  Wrote ${newKeys.length} missing models into ${registryPath}`)
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
  const writeToRegistry = args.has('--write') || args.has('-w')

  if (shouldUpdateBaseline)
    await updateBaseline()
  else
    await diffModels({ showMissingFromRegistry, writeToRegistry })
}

main().catch((error) => {
  console.error('❌ report script failed:', error)
  process.exit(1)
})
