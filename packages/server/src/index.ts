import { env } from 'cloudflare:workers'
import { Elysia } from 'elysia'
import { CloudflareAdapter } from 'elysia/adapter/cloudflare-worker'
import { createApp } from './app'
import cronHandler, { runCronJob } from './cron'
import { createAllowedOriginChecker, createManifestLoader } from './utils'

export const app = new Elysia({
  adapter: CloudflareAdapter,
})
  .use(createApp({
    loadManifest: createManifestLoader(env),
    getAllowedOrigin: createAllowedOriginChecker(env),
    runCronJob: () => runCronJob(env),
    getCronAuthToken: () => env.CRON_AUTH_TOKEN,
  }))
  .compile()

export default {
  fetch: app.fetch,
  scheduled: cronHandler.scheduled,
}
