# Registry Snapshots

This directory contains automatically updated snapshots of the LLM registry.

These files are updated daily by a GitHub Action that fetches the latest data from the deployed API.

## Files

- **`version.json`** - Version information and metadata
- **`providers.json`** - List of all LLM providers
- **`models.json`** - List of all models with simplified data

## Usage

You can fetch these files directly from GitHub:

```bash
# Get the latest providers
curl https://raw.githubusercontent.com/Rettend/llm/main/public/providers.json

# Get the latest models
curl https://raw.githubusercontent.com/Rettend/llm/main/public/models.json

# Check the version
curl https://raw.githubusercontent.com/Rettend/llm/main/public/version.json
```

## Data Structure

### version.json

```json
{
  "version": "v1.1234567890",
  "generatedAt": "2025-01-15T03:00:00.000Z",
  "providers": 10,
  "models": 50
}
```

### providers.json

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

### models.json

```json
[
  {
    "provider": "openai",
    "value": "gpt-5",
    "name": "GPT-5",
    "alias": "GPT-5",
    "iq": 5,
    "speed": 3,
    "pricing": 3.44,
    "status": "active"
  }
]
```

## Updates

This data is automatically updated daily at 3 AM UTC via GitHub Actions.

For the most up-to-date data, use the API directly: <https://llm.your-subdomain.workers.dev/v1/manifest>
