/// <reference types="@cloudflare/workers-types" />

declare namespace Cloudflare {
  interface Env {
    /** API key for Artificial Analysis */
    AA_API_KEY: string
    /** Optional comma-separated list of allowed origins for CORS */
    ALLOWED_ORIGINS?: string

    REGISTRY: KVNamespace
  }
}
