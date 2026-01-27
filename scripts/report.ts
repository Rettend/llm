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

async function diffModels(options: {
  showMissingFromRegistry?: boolean
  writeToRegistry?: boolean
  pruneRegistry?: boolean
} = {}) {
  const { showMissingFromRegistry = false, writeToRegistry = false, pruneRegistry = false } = options
  const hasCurrent = await fileExists(CURRENT_MODELS_PATH)
  if (!hasCurrent) {
    console.error(`❌ ${CURRENT_MODELS_PATH} not found. Make sure you've pulled the latest public data.`)
    process.exit(1)
  }

  const currentModels = await loadModels(CURRENT_MODELS_PATH)
  const baselineExists = await fileExists(BASELINE_MODELS_PATH)
  const baselineModels = baselineExists ? await loadModels(BASELINE_MODELS_PATH) : []

  const registryKeySet = new Set(getRegistryKeys())

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
    for (const key of registryKeySet) {
      if (!currentKeys.has(key))
        missingFromCurrent.push(key)
    }
  }

  const statusHistogram = new Map<string, number>()
  for (const model of currentModels) {
    const status = model.status ?? 'unknown'
    statusHistogram.set(status, (statusHistogram.get(status) ?? 0) + 1)
  }

  const previewWithoutRegistry = currentModels.filter(model => model.status === 'preview' && !registryKeySet.has(keyOf(model)))

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

  if (currentModels.length) {
    const orderedStatuses = ['latest', 'preview', 'all']
    console.log('Status breakdown:')
    for (const status of orderedStatuses) {
      const count = statusHistogram.get(status) ?? 0
      console.log(`- ${status.padEnd(7)} ${count.toString().padStart(3)} models`)
    }
    const unknownStatuses = Array.from(statusHistogram.keys()).filter(status => !orderedStatuses.includes(status))
    if (unknownStatuses.length) {
      for (const status of unknownStatuses) {
        const count = statusHistogram.get(status) ?? 0
        console.log(`- ${status.padEnd(7)} ${count.toString().padStart(3)} models`)
      }
    }
    console.log()
  }

  if (!newKeys.length && !removedKeys.length && !missingFromCurrent.length) {
    console.log('✅ No changes since the last baseline.')
    return
  }

  if (previewWithoutRegistry.length) {
    console.log('🕒 Preview models missing curated registry entries:')
    for (const model of previewWithoutRegistry) {
      const displayName = model.name ? ` — ${model.name}` : ''
      console.log(`- ${model.provider}/${model.value}${displayName}`)
    }
    console.log()
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

    const closeIndex = after.lastIndexOf('})')
    if (closeIndex === -1)
      throw new Error(`Could not locate closing of MODEL_REGISTRY in ${registryPath}`)

    let bodyBeforeClose = after.slice(0, closeIndex)
    const bodyAfterClose = after.slice(closeIndex)

    // Now append new entries (merge into existing providers when possible)
    // Now append new entries (merge into existing providers when possible)
    for (const [provider, models] of providerGroups) {
      const providerKey = `\n  '${provider}': {\n`
      const providerIndex = bodyBeforeClose.indexOf(providerKey)

      if (providerIndex !== -1) {
        // Provider already exists: insert models AT THE TOP (after `{\n`)
        const insertionIndex = providerIndex + providerKey.length

        const before = bodyBeforeClose.slice(0, insertionIndex)
        const after = bodyBeforeClose.slice(insertionIndex)

        const modelLines: string[] = []
        for (const model of models) {
          modelLines.push(`    '${model.value}': {`)
          modelLines.push(`      contextWindow: 100_000,`)
          modelLines.push(`      capabilities: _(text),`)
          modelLines.push(`    },`)
        }

        const newBlock = `${modelLines.join('\n')}\n`
        bodyBeforeClose = before + newBlock + after
      }
      else {
        // New provider: prepend a fresh block at the START of the registry body
        const providerLines: string[] = []
        providerLines.push(`\n  '${provider}': {`)
        for (const model of models) {
          providerLines.push(`    '${model.value}': {`)
          providerLines.push(`      contextWindow: 100_000,`)
          providerLines.push(`      capabilities: _(text),`)
          providerLines.push(`    },`)
        }
        providerLines.push(`  },`)

        bodyBeforeClose = providerLines.join('\n') + bodyBeforeClose
      }
    }

    lines.push(bodyBeforeClose)
    lines.push(bodyAfterClose)

    await fs.writeFile(registryPath, lines.join(''), 'utf8')

    console.log(`✏️  Wrote ${newKeys.length} missing models into ${registryPath}`)
  }

  if (removedKeys.length) {
    if (pruneRegistry) {
      const registryPath = 'packages/shared/src/registry.ts'
      let registrySource = await fs.readFile(registryPath, 'utf8')
      let removedCount = 0

      for (const key of removedKeys) {
        const model = baselineMap.get(key)!
        const regex = new RegExp(`\\n\\s+'${model.value}': \\{[\\s\\S]*?\\},`, 'g')

        if (regex.test(registrySource)) {
          registrySource = registrySource.replace(regex, '')
          removedCount++
        }
        else {
          console.warn(`⚠️ Could not find code block for ${model.provider}/${model.value} to prune.`)
        }
      }

      const emptyProviderRegex = /\n\s+'[^']+': \{\n\s+\},/g
      while (emptyProviderRegex.test(registrySource))
        registrySource = registrySource.replace(emptyProviderRegex, '')

      await fs.writeFile(registryPath, registrySource, 'utf8')
      console.log(`✂️  Pruned ${removedCount} outdated models from ${registryPath}`)
    }
    else {
      console.log('📤 Models present in baseline but missing from current public data:')
      for (const key of removedKeys) {
        const model = baselineMap.get(key)!
        const displayName = model.name ? ` — ${model.name}` : ''
        console.log(`- ${model.provider}/${model.value}${displayName}`)
      }
      console.log('   (Run with --prune to remove these from registry)')
      console.log()
    }
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
  const pruneRegistry = args.has('--prune') || args.has('-p')

  if (shouldUpdateBaseline)
    await updateBaseline()
  else
    await diffModels({ showMissingFromRegistry, writeToRegistry, pruneRegistry })
}

main().catch((error) => {
  console.error('❌ report script failed:', error)
  process.exit(1)
})
