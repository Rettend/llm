/* eslint-disable no-console */
/**
 * Fetch raw Artificial Analysis LLM models JSON locally.
 * Usage:
 *   bun run scripts/fetch-aa.ts
 * Requires AA_API_KEY in environment (.env at repo root).
 * Output:
 *   data/aa-models.json (ignored by git)
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'

const API_URL = 'https://artificialanalysis.ai/api/v2/data/llms/models'
const OUT_DIR = resolve(process.cwd(), 'data')
const OUT_FILE = resolve(OUT_DIR, 'aa-models.json')

async function main() {
  const apiKey = process.env.AA_API_KEY
  if (!apiKey) {
    console.error('AA_API_KEY is not set in environment (.env)')
    process.exit(1)
  }

  console.log('Fetching AA models from', API_URL)
  const res = await fetch(API_URL, {
    headers: {
      'x-api-key': apiKey,
      'accept': 'application/json',
    },
  })

  if (!res.ok) {
    console.error('Failed to fetch AA models:', res.status, res.statusText)
    process.exit(1)
  }

  const raw = await res.text()
  await mkdir(OUT_DIR, { recursive: true })
  await writeFile(OUT_FILE, raw)
  console.log('Saved AA models JSON to', OUT_FILE)
}

main().catch((err) => {
  console.error('Unexpected error fetching AA models:', err)
  process.exit(1)
})
