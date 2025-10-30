/// <reference types="@cloudflare/workers-types" />

interface Env {
  AA_API_KEY: string
  REGISTRY: KVNamespace
  ALLOWED_ORIGINS?: string
}

declare module 'cloudflare:workers' {
  export const env: Env
}
