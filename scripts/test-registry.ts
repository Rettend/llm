/* eslint-disable no-console */
import { createRegistry } from '../packages/client'

const registry = createRegistry({ baseUrl: 'https://llm.rettend.me' })

function pickFields(models: any[] | null) {
  return (models ?? []).map(m => ({
    value: m.value,
    name: m.name ?? null,
    provider: m.provider,
    status: m.status ?? null,
  }))
}

function printRowsInline(rows: { value: string, name: string | null, provider: string, status: string | null }[]) {
  for (const r of rows)
    console.log(`${r.value}, ${r.name ?? ''}, ${r.provider}, ${r.status ?? ''}`)
}

async function run() {
  try {
    const { data: latestOpenAI, error: err1, cached: cached1 } = await registry.searchModels({
      provider: 'openai',
      status: 'latest',
    })
    if (err1) {
      console.error('Error fetching latest OpenAI models:', err1)
    }
    else {
      const rows = pickFields(latestOpenAI)
      console.log('Latest OpenAI models:', rows.length, ` (cached: ${!!cached1})`)
      printRowsInline(rows)
    }

    const { data: previewAnthropic, error: err2, cached: cached2 } = await registry.searchModels({
      provider: 'anthropic',
      status: 'preview',
    })
    if (err2) {
      console.error('Error fetching preview Anthropic models:', err2)
    }
    else {
      const rows = pickFields(previewAnthropic)
      console.log('Preview Anthropic models:', rows.length, ` (cached: ${!!cached2})`)
      printRowsInline(rows)
    }

    const { data: test, error: err3, cached: cached3 } = await registry.searchModels({
      provider: ['openai', 'anthropic'],
      status: ['latest', 'preview'],
    })
    if (err3) {
      console.error('Error fetching test models:', err3)
    }
    else {
      const rows = pickFields(test)
      console.log('Test models:', rows.length, ` (cached: ${!!cached3})`)
      printRowsInline(rows)
    }
  }
  catch (error) {
    console.error('Unexpected error:', error)
  }
  finally {
    if (typeof registry.destroy === 'function')
      registry.destroy()
  }
}

await run()
