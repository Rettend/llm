# LLM Registry API Overview

The LLM Registry API exposes model metadata aggregated from Artificial Analysis and extended with custom overrides. As of v1.5, the registry automatically aggregates models into **canonical families** and provides structured **reasoning metadata** so you don't have to guess or manually manage reasoning efforts.

## Data Model

At the core of the registry are two objects: **Provider** and **Model**.

### Model Object

A model object in the manifest is **canonical by default**. This means that if a provider offers multiple variants of the same model solely to control reasoning effort (e.g. `gpt-5` and `gpt-5-non-reasoning`, or `nova-pro`, `nova-pro-low`, etc.), they are collapsed into a single `Model` entry.

```ts
interface Model {
  id: string          // Original AA id
  value: string       // Canonical Model identifier for AI SDK
  provider: string    // Provider slug
  name: string        // Full display name (e.g. "GPT-5")
  alias?: string      // Short name for UI dropdowns
  
  capabilities?: {
    text?: boolean
    vision?: boolean
    reasoning?: boolean
    audio?: boolean
  }

  // Baseline performance & pricing
  iq?: 0 | 1 | 2 | 3 | 4 | 5
  speed?: 0 | 1 | 2 | 3 | 4 | 5
  metrics?: {
    contextWindow?: number
    intelligenceIndex?: number | null
    // ...
  }
  pricing?: {
    input?: number | null
    output?: number | null
    blended?: number | null
  }

  // Reasoning Metadata
  reasoningControl?: ReasoningControl
}
```

### Reasoning Control

Models that support reasoning expose a `reasoningControl` object detailing exactly which options are available, and what underlying `model` identifier and `effort` configuration you should pass to your AI SDK.

```ts
interface ReasoningControl {
  default: string // Option ID to use by default (e.g. "default", "thinking")
  options: Array<{
    id: string    // e.g. "default", "thinking", "low", "medium", "high"
    model: string // The exact provider model string to send
    effort?: string // The provider-specific effort level to send (if applicable)
    iq?: 0 | 1 | 2 | 3 | 4 | 5 // Optional score override for this option
    speed?: 0 | 1 | 2 | 3 | 4 | 5 // Optional score override for this option
  }>
}
```

`Model.iq` and `Model.speed` represent the default option. If an option omits `iq` or `speed`, it inherits the model default.

**Example (Azure Grok - toggled via model string):**

```json
{
  "reasoningControl": {
    "default": "default",
    "options": [
      { "id": "default", "model": "grok-4-fast-non-reasoning" },
      { "id": "thinking", "model": "grok-4-fast-reasoning" }
    ]
  }
}
```

**Example (OpenAI GPT-5 - toggled via effort params):**

```json
{
  "reasoningControl": {
    "default": "default",
    "options": [
      { "id": "default", "model": "gpt-5-non-reasoning" },
      { "id": "low", "model": "gpt-5", "effort": "low" },
      { "id": "high", "model": "gpt-5", "effort": "high" }
    ]
  }
}
```

### Resolving Selections

The `@rttnd/llm` client library provides a helper to take a canonical model and a selected dropdown ID and return the correct provider model ID, effort, and resolved IQ/speed:

```typescript
import { resolveReasoningProfile } from '@rttnd/llm'

const model = fetch(/* get from registry */)
const profile = resolveReasoningProfile(model, 'high')

// Output: { id: "high", model: "gpt-5", effort: "high", iq: 5, speed: 3 }
```
