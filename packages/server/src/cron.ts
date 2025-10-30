import { fetchAndTransformManifest } from './transform'

export default {
  async scheduled(event: ScheduledEvent, env: Cloudflare.Env) {
    try {
      const apiKey = env.AA_API_KEY
      if (!apiKey)
        throw new Error('AA_API_KEY is not set')

      // Fetch and transform the manifest
      const manifest = await fetchAndTransformManifest(apiKey)

      // Store in KV
      await env.REGISTRY.put('manifest', JSON.stringify(manifest))

      // eslint-disable-next-line no-console
      console.log('Manifest updated successfully:', {
        version: manifest.version,
        providers: manifest.providers.length,
        models: manifest.models.length,
        generatedAt: manifest.generatedAt,
      })
    }
    catch (error) {
      console.error('Failed to update manifest:', error)
    }
  },
}
