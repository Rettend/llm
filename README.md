# LLM Registry

A lightweight, cache-optimized LLM registry that auto-updates from Artificial Analysis API daily and runs on Cloudflare Workers.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Rettend/llm)

## Quick Start

### Deploy the API

1. #### Click the Deploy button above

    Build command: None

    Deploy command: `bunx wrangler deploy`

    Root directory: `/`

2. #### Create a KV namespace

    Go to **Storage & Databases** > **Workers KV**

    Copy the Namespace ID

3. #### Change `wrangler.toml`

    Use your custom domain or delete that line to use `your-subdomain.workers.dev`

    Change the kv_namespace id to your created Namespace ID

4. #### Set **Variables and Secrets** from `.env`

    See [Environment Variables](#environment-variables) below

5. #### If you want to deploy it manually without waiting until 2AM

    ```bash
    bunx wrangler deploy
    ```

    ```bash
    bun run seed
    ```

    ```bash
    wrangler kv key put --binding REGISTRY manifest --path ./data/manifest-preview.json
    ```

### Use the Client Library

```bash
bun add @rttnd/llm
```

```typescript
import { createRegistry } from '@rttnd/llm'

const registry = createRegistry({
  baseUrl: 'https://llm.your-subdomain.workers.dev',
})

// Get all models
const { data: models } = await registry.getModels()

// Search for models
const { data: visionModels } = await registry.searchModels({
  capability: 'vision',
  minIq: 3,
})

// Get specific model details
const { data: model } = await registry.getModel('openai', 'gpt-5')
```

See the [Client Library Documentation](./packages/client/README.md) for more details.

## API Endpoints

### GET `/v1/manifest`

Returns the complete manifest with all providers and models.

**Response:**

```json
{
  "version": "v1.5c3e2c7d9f8a",
  "etag": "\"5c3e2c7d9f8a6b4c1d0e9f8a6b4c1d0e\"",
  "generatedAt": "2025-01-15T02:00:00.000Z",
  "providers": [/* ... */],
  "models": [/* ... */]
}
```

### GET `/v1/providers`

Returns list of all providers.

**Response:**

```json
[
  {
    "value": "openai",
    "name": "OpenAI",
    "keyPlaceholder": "sk-...",
    "website": "https://platform.openai.com/api-keys",
    "status": "active"
  }
]
```

### GET `/v1/providers/:providerId/models`

Returns models for a specific provider.

**Response:**

```json
[
  {
    "id": "...",
    "value": "gpt-5",
    "provider": "openai",
    "name": "GPT-5",
    "alias": "GPT-5",
    "iq": 5,
    "speed": 3,
    "pricing": {
      "input": 1.25,
      "output": 10,
      "blended": 3.44
    }
  }
]
```

### GET `/v1/models/search`

Search models with query parameters rather than downloading the full manifest.

**Query Parameters:**

- `name` - Filter by partial match across name, value, or alias
- `provider` - Restrict results to a specific provider slug
- `capability` - Require a capability (`text`, `vision`, `reasoning`, `toolUse`, `json`, `audio`)
- `minIq` - Minimum IQ score (0-5)
- `minSpeed` - Minimum speed score (0-5)

**Response:**

```json
[
  {
    "id": "...",
    "value": "gpt-5",
    "provider": "openai",
    "name": "GPT-5",
    "iq": 5,
    "speed": 3,
    "capabilities": {
      "vision": true,
      "text": true
    }
  }
]
```

### GET `/v1/version`

Returns version info for update checks.

**Response:**

```json
{
  "version": "v1.5c3e2c7d9f8a",
  "etag": "\"5c3e2c7d9f8a6b4c1d0e9f8a6b4c1d0e\"",
  "generatedAt": "2025-01-15T02:00:00.000Z"
}
```

### GET `/health`

Health check endpoint.

**Response:**

```json
{
  "status": "ok"
}
```

## Configuration

### Environment Variables

Set these in Cloudflare dashboard or via `wrangler secret`:

- `AA_API_KEY` - Your Artificial Analysis API key (<https://artificialanalysis.ai/documentation>)
- `ALLOWED_ORIGINS` - Comma-separated CORS origins (e.g., `https://app.com,https://*.example.com`), use `*` to allow all origins.

### Cron Schedule

The default cron schedule is daily at 2 AM UTC in `wrangler.toml`:

```toml
[triggers]
crons = [ "0 2 * * *" ]
```

## Architecture

### Data Flow

1. **Cloudflare Cron** fetches from Artificial Analysis API daily
2. **Transform** converts AA data to normalized model format
3. **Store** saves manifest to Workers KV
4. **Serve** manifest from Worker
5. **GitHub Action** publishes human-readable snapshot
6. **Me:** I add the missing data to the registry that's missing from the AA API

### Scoring System

**IQ Score (0-5):**

- 5: Intelligence Index ≥ 65
- 4: Intelligence Index ≥ 55
- 3: Intelligence Index ≥ 45
- 2: Intelligence Index ≥ 35
- 1: Intelligence Index ≥ 25
- 0: < 25

**Speed Score (0-5):**

- 5: ≥ 300 tokens/sec
- 4: ≥ 200 tokens/sec
- 3: ≥ 100 tokens/sec
- 2: ≥ 50 tokens/sec
- 1: ≥ 25 tokens/sec
- 0: < 25

## License

MIT

## Credits

Data from [Artificial Analysis](https://artificialanalysis.ai/)
