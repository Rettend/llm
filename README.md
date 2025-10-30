# LLM Registry

A lightweight, cache-optimized LLM registry system that auto-updates from Artificial Analysis API daily and serves via Cloudflare Workers.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=Rettend/llm)

## Features

- 🔄 **Auto-updates** from Artificial Analysis API daily via Cron
- ⚡ **Blazing fast** with aggressive caching at CDN, KV, and client layers
- 🌍 **Edge-optimized** runs on Cloudflare Workers globally
- 🔒 **Type-safe** full TypeScript support with Eden
- 📦 **Zero maintenance** apps auto-update without redeployment
- 🎯 **Smart scoring** automatic IQ and speed ratings (0-5 scale)
- 🧩 **Capabilities mapping** curated model capabilities (vision, tools, JSON, etc.)

## Quick Start

Click the Deploy button above!

## API Endpoints

### GET `/v1/manifest`

Returns the complete manifest with all providers and models.

**Response:**

```json
{
  "version": "v1.1234567890",
  "etag": "W/\"...\"",
  "generatedAt": "2025-01-15T02:00:00.000Z",
  "providers": [/*...*/],
  "models": [/*...*/]
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

### GET `/v1/version`

Returns version info for update checks.

**Response:**

```json
{
  "version": "v1.1234567890",
  "etag": "W/\"...\"",
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
- `ALLOWED_ORIGINS` - Comma-separated CORS origins (e.g., `https://app.com,https://*.example.com`)

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
3. **Score** calculates IQ (intelligence) and Speed ratings
4. **Store** saves manifest to Workers KV
5. **Serve** with aggressive caching (CDN + ETags)
6. **GitHub Action** publishes human-readable snapshot

### Capabilities

Model capabilities (vision, tool use, JSON mode, etc.) and context windows are manually curated in `packages/shared/src/capabilities.ts`. To verify or update capabilities, run:

```bash
bun run probe
```

### Caching

- **CDN**: `max-age=600` (10 min), `s-maxage=86400` (1 day)
- **Stale-while-revalidate**: 7 days
- **Stale-if-error**: 7 days
- **ETag**s

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
