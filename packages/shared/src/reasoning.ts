import type { Model, ReasoningControlOption, ReasoningOptionID } from './types'

export interface ResolvedReasoningSelection {
  id: ReasoningOptionID
  model: string
  effort?: string
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
