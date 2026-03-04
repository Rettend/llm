import type { Model, ReasoningControlOption, ReasoningOptionID } from './types'

export interface ResolvedReasoningSelection {
  id: ReasoningOptionID
  model: string
  effort?: string
}

export interface ResolvedReasoningProfile extends ResolvedReasoningSelection {
  iq?: Model['iq']
  speed?: Model['speed']
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

function findOptionTarget(
  modelByKey: ReadonlyMap<string, Model>,
  provider: string,
  sortedGroup: Model[],
  optionModel: string,
): Model | undefined {
  return modelByKey.get(keyOf(provider, optionModel))
    ?? sortedGroup.find(model => model.value === optionModel)
}

function enrichReasoningOptions(input: {
  options: ReasoningControlOption[]
  defaultOptionID: ReasoningOptionID
  defaultTarget: Model | undefined
  provider: string
  sortedGroup: Model[]
  modelByKey: ReadonlyMap<string, Model>
}): ReasoningControlOption[] {
  const defaultIQ = input.defaultTarget?.iq
  const defaultSpeed = input.defaultTarget?.speed

  return input.options.map((option) => {
    const next: ReasoningControlOption = { ...option }

    if (option.id === input.defaultOptionID) {
      delete next.iq
      delete next.speed
      return next
    }

    const target = findOptionTarget(input.modelByKey, input.provider, input.sortedGroup, option.model)
    const optionIQ = next.iq ?? target?.iq
    const optionSpeed = next.speed ?? target?.speed

    if (optionIQ !== undefined && optionIQ !== defaultIQ)
      next.iq = optionIQ
    else
      delete next.iq

    if (optionSpeed !== undefined && optionSpeed !== defaultSpeed)
      next.speed = optionSpeed
    else
      delete next.speed

    return next
  })
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

    if (canonical.reasoningControl && canonical.reasoningControl.options.length > 0) {
      const defaultOption = canonical.reasoningControl.options.find(option => option.id === canonical.reasoningControl?.default)
        ?? canonical.reasoningControl.options[0]

      const defaultTarget = defaultOption
        ? findOptionTarget(modelByKey, provider, sortedGroup, defaultOption.model)
        : undefined

      if (defaultOption) {
        canonical.reasoningControl.options = enrichReasoningOptions({
          options: canonical.reasoningControl.options,
          defaultOptionID: defaultOption.id,
          defaultTarget,
          provider,
          sortedGroup,
          modelByKey,
        })
      }

      if (defaultTarget) {
        canonical.id = defaultTarget.id
        canonical.name = normalizeCanonicalName(defaultTarget.name)
        canonical.alias = defaultTarget.alias
        canonical.iq = defaultTarget.iq
        canonical.speed = defaultTarget.speed
        canonical.metrics = defaultTarget.metrics ? { ...defaultTarget.metrics } : undefined
        canonical.pricing = defaultTarget.pricing ? { ...defaultTarget.pricing } : undefined
        canonical.releaseDate = defaultTarget.releaseDate
        canonical.status = defaultTarget.status
        canonical.config = defaultTarget.config ? { ...defaultTarget.config } : undefined
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
  model: Pick<Model, 'value' | 'reasoningControl' | 'iq' | 'speed'>,
  optionID?: string | null,
): ResolvedReasoningProfile {
  const selection = resolveReasoningSelection(model, optionID)
  const control = model.reasoningControl

  if (!control || control.options.length === 0) {
    return {
      ...selection,
      iq: model.iq,
      speed: model.speed,
    }
  }

  const defaultOption = control.options.find(option => option.id === control.default) ?? control.options[0]
  const resolvedOption = control.options.find(option => option.id === selection.id)
  const defaultIQ = defaultOption?.iq ?? model.iq
  const defaultSpeed = defaultOption?.speed ?? model.speed

  return {
    ...selection,
    iq: resolvedOption?.iq ?? defaultIQ,
    speed: resolvedOption?.speed ?? defaultSpeed,
  }
}
