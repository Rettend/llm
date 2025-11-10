/* eslint-disable no-console */
import process from 'node:process'

/**
 * Seed the KV namespace with the initial manifest
 * Usage: bun run seed
 */
import { fetchAndTransformManifest } from '../packages/server/src/transform'

async function main() {
  const apiKey = process.env.AA_API_KEY
  if (!apiKey) {
    console.error('❌ AA_API_KEY environment variable is not set')
    console.error('   Make sure you have a .env file with your API key')
    process.exit(1)
  }

  console.log('🔄 Fetching data from Artificial Analysis API...')

  try {
    const manifest = await fetchAndTransformManifest(apiKey)

    console.log('✅ Manifest generated successfully!')
    console.log(`   Version: ${manifest.version}`)
    console.log(`   Providers: ${manifest.providers.length}`)
    console.log(`   Models: ${manifest.models.length}`)
    console.log(`   Generated at: ${manifest.generatedAt}`)
    console.log()

    const outputPath = './data/manifest-preview.json'
    await Bun.write(outputPath, JSON.stringify(manifest, null, 2))
    console.log(`📄 Preview saved to: ${outputPath}`)
    console.log()

    console.log('📦 To upload to KV, run:')
    console.log(`   wrangler kv key put --binding REGISTRY manifest --path ${outputPath}`)
  }
  catch (error) {
    console.error('❌ Failed to generate manifest:', error)
    process.exit(1)
  }
}

main()
