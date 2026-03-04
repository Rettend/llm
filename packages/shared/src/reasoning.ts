import type { Model, ReasoningControlOption, ReasoningOptionID, ReasoningProfile } from './types'

export interface ResolvedReasoningSelection {
  id: ReasoningOptionID
  model: string
  effort?: string
}

const REASONING_NAME_SUFFIX = /\s*\((?:non[-\s]?reasoning(?:[-\s]low[-\s]effort)?|reasoning|thinking|adaptive)\)\s*$/i

function keyOf(provider: string, value: string): string {
  return `${provider}:${value}`
}

function deriveCanonicalValue(value: string): string {
  return value
    .replace(/-non-reasoning(?:-low-effort)?$/i, '')
    .replace(/-thinking-preview$/i, '')
    .replace(/-reasoning-preview$/i, '')
    .replace(/-reasoning-(?:none|minimal|low|medium|high|max|xhigh)$/i, '')
    .replace(/-reasoning$/i, '')
    .replace(/-thinking$/i, '')
    .replace(/-adaptive$/i, '')
}

function chooseCanonicalValue(model: Model): string {
  const control = model.reasoningControl
  if (!control || control.options.length === 0)
    return model.value

  const optionModels = Array.from(new Set(control.options.map(option => option.model)))
  const optionSet = new Set(optionModels)

  for (const optionModel of optionModels) {
    const cleaned = deriveCanonicalValue(optionModel)
    if (optionSet.has(cleaned))
      return cleaned
  }

  const nonDefault = control.options.find(option => option.id !== control.default)
  if (nonDefault)
    return deriveCanonicalValue(nonDefault.model)

  return deriveCanonicalValue(model.value)
}

function cloneModel(model: Model): Model {
  return {
    ...model,
    capabilities: model.capabilities ? { ...model.capabilities } : undefined,
    reasoningControl: model.reasoningControl
      ? {
          default: model.reasoningControl.default,
          options: model.reasoningControl.options.map(option => ({ ...option })),
        }
      : undefined,
    metrics: model.metrics ? { ...model.metrics } : undefined,
    pricing: model.pricing ? { ...model.pricing } : undefined,
    config: model.config ? { ...model.config } : undefined,
  }
}

function normalizeCanonicalName(name: string): string {
  const stripped = name.replace(REASONING_NAME_SUFFIX, '').trim()
  return stripped || name
}

function getDefaultModelValue(model: Model): string {
  const control = model.reasoningControl
  if (!control || control.options.length === 0)
    return model.value

  const defaultOption = control.options.find(option => option.id === control.default)
  return defaultOption?.model ?? control.options[0]!.model
}

function toReasoningProfile(option: ReasoningControlOption, target: Model | undefined): ReasoningProfile {
  return {
    id: option.id,
    model: option.model,
    effort: option.effort,
    iq: target?.iq,
    speed: target?.speed,
    metrics: target?.metrics ? { ...target.metrics } : undefined,
    pricing: target?.pricing ? { ...target.pricing } : undefined,
    status: target?.status,
    releaseDate: target?.releaseDate,
  }
}

export function getReasoningOptions(model: Pick<Model, 'reasoningControl'>): ReasoningControlOption[] {
  const options = model.reasoningControl?.options ?? []
  return options.map(option => ({ ...option }))
}

export function resolveReasoningSelection(
  model: Pick<Model, 'value' | 'reasoningControl'>,
  optionID?: string | null,
): ResolvedReasoningSelection {
  const control = model.reasoningControl
  if (!control || control.options.length === 0) {
    return {
      id: 'default',
      model: model.value,
    }
  }

  const selected = optionID
    ? control.options.find(option => option.id === optionID)
    : undefined

  const defaultOption = control.options.find(option => option.id === control.default)
  const resolved = selected ?? defaultOption ?? control.options[0]!

  return {
    id: resolved.id,
    model: resolved.model,
    effort: resolved.effort,
  }
}

export function canonicalizeModels(models: Model[]): Model[] {
  const modelByKey = new Map<string, Model>()
  for (const model of models)
    modelByKey.set(keyOf(model.provider, model.value), model)

  const grouped = new Map<string, Model[]>()
  for (const model of models) {
    const groupKey = keyOf(model.provider, getDefaultModelValue(model))
    const group = grouped.get(groupKey)
    if (group)
      group.push(model)
    else
      grouped.set(groupKey, [model])
  }

  const canonicalModels: Model[] = []

  for (const [groupKey, group] of grouped) {
    const [, defaultValue] = groupKey.split(':', 2)
    const sortedGroup = [...group].sort((a, b) => a.value.localeCompare(b.value))
    const defaultModel = sortedGroup.find(model => model.value === defaultValue)
    const source = defaultModel ?? sortedGroup[0]!
    const provider = source.provider
    const canonicalValue = chooseCanonicalValue(source)

    const canonical = cloneModel(source)
    canonical.value = canonicalValue
    canonical.name = normalizeCanonicalName(canonical.name)
    canonical.variantValues = Array.from(new Set(sortedGroup.map(model => model.value))).sort((a, b) => a.localeCompare(b))

    if (canonical.reasoningControl && canonical.reasoningControl.options.length > 0) {
      const profiles = canonical.reasoningControl.options.map((option) => {
        const target = modelByKey.get(keyOf(provider, option.model))
          ?? sortedGroup.find(model => model.value === option.model)
        return toReasoningProfile(option, target)
      })

      canonical.reasoningProfiles = profiles

      const defaultProfile = profiles.find(profile => profile.id === canonical.reasoningControl?.default) ?? profiles[0]
      if (defaultProfile) {
        const target = modelByKey.get(keyOf(provider, defaultProfile.model))
          ?? sortedGroup.find(model => model.value === defaultProfile.model)
        if (target) {
          canonical.id = target.id
          canonical.name = normalizeCanonicalName(target.name)
          canonical.alias = target.alias
          canonical.iq = target.iq
          canonical.speed = target.speed
          canonical.metrics = target.metrics ? { ...target.metrics } : undefined
          canonical.pricing = target.pricing ? { ...target.pricing } : undefined
          canonical.releaseDate = target.releaseDate
          canonical.status = target.status
          canonical.config = target.config ? { ...target.config } : undefined
        }
      }
    }

    canonicalModels.push(canonical)
  }

  return canonicalModels.sort((a, b) => {
    if (a.provider === b.provider)
      return a.value.localeCompare(b.value)

    return a.provider.localeCompare(b.provider)
  })
}

export function resolveReasoningProfile(
  model: Pick<Model, 'value' | 'reasoningControl' | 'reasoningProfiles'>,
  optionID?: string | null,
): ReasoningProfile {
  const selection = resolveReasoningSelection(model, optionID)
  const profile = model.reasoningProfiles?.find(item => item.id === selection.id)

  if (!profile)
    return selection

  return {
    ...profile,
    metrics: profile.metrics ? { ...profile.metrics } : undefined,
    pricing: profile.pricing ? { ...profile.pricing } : undefined,
  }
}
