/* eslint-disable eslint-comments/no-unlimited-disable */
/* eslint-disable */
// @ts-nocheck
/**
 * Probe script to test model capabilities using Vercel AI SDK.
 *
 * This script attempts to verify model capabilities like vision, tool calling,
 * JSON mode, and reasoning by making real API calls.
 *
 * Usage:
 * 1. Set up API keys in .dev.vars:
 *    OPENAI_API_KEY=sk-...
 *    ANTHROPIC_API_KEY=sk-ant-...
 *    GOOGLE_API_KEY=AI...
 *
 * 2. Run the probe:
 *    bun run packages/server/scripts/probe-capabilities.ts
 *
 * 3. Update packages/shared/src/capabilities.ts with the results
 */

import { anthropic } from '@ai-sdk/anthropic'
import { google } from '@ai-sdk/google'
import { openai } from '@ai-sdk/openai'
import { generateObject, generateText } from 'ai'
import { z } from 'zod'

interface ProbeResult {
  provider: string
  modelValue: string
  capabilities: {
    text: boolean
    vision: boolean
    reasoning: boolean
    toolUse: boolean
    json: boolean
    audio: boolean
  }
  errors: string[]
}

async function probeTextCapability(model: any): Promise<boolean> {
  try {
    const { text } = await generateText({
      model,
      prompt: 'Say "ok"',
      maxTokens: 10,
    })
    return text.length > 0
  }
  catch (error: any) {
    console.error('Text capability error:', error.message)
    return false
  }
}

async function probeVisionCapability(model: any): Promise<boolean> {
  try {
    const { text } = await generateText({
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What color is this square?' },
            {
              type: 'image',
              image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', // 1x1 red pixel
            },
          ],
        },
      ],
      maxTokens: 50,
    })
    return text.toLowerCase().includes('red')
  }
  catch (error: any) {
    // Check if error is about unsupported feature vs actual API error
    if (error.message?.includes('vision') || error.message?.includes('image') || error.message?.includes('multimodal'))
      return false

    console.error('Vision capability error:', error.message)
    return false
  }
}

async function probeToolUseCapability(model: any): Promise<boolean> {
  try {
    const { toolCalls } = await generateText({
      model,
      prompt: 'What is the weather in San Francisco?',
      tools: {
        getWeather: {
          description: 'Get the weather for a location',
          parameters: z.object({
            location: z.string().describe('The location to get weather for'),
          }),
        },
      },
      maxToolRoundtrips: 0,
      maxTokens: 100,
    })
    return toolCalls.length > 0
  }
  catch (error: any) {
    if (error.message?.includes('tool') || error.message?.includes('function'))
      return false

    console.error('Tool use capability error:', error.message)
    return false
  }
}

async function probeJsonCapability(model: any): Promise<boolean> {
  try {
    const { object } = await generateObject({
      model,
      schema: z.object({
        name: z.string(),
        age: z.number(),
      }),
      prompt: 'Generate a person named John who is 30 years old',
    })
    return object.name === 'John' && object.age === 30
  }
  catch (error: any) {
    if (error.message?.includes('json') || error.message?.includes('structured'))
      return false

    console.error('JSON capability error:', error.message)
    return false
  }
}

async function probeReasoningCapability(model: any, modelName: string): Promise<boolean> {
  // Reasoning is typically indicated by model name or family
  // Models with "reasoning" in their config or extended thinking capabilities
  const reasoningModels = ['o1', 'o3', 'codex', 'deepthink', 'extended-thinking']

  return reasoningModels.some(keyword => modelName.toLowerCase().includes(keyword))
}

async function probeAudioCapability(model: any): Promise<boolean> {
  // Audio capabilities are rare and provider-specific
  // This would require specific audio API endpoints
  // For now, we return false and manually mark known audio models
  return false
}

async function probeModel(provider: string, modelValue: string, model: any): Promise<ProbeResult> {
  console.log(`\n🔍 Probing ${provider}/${modelValue}...`)

  const result: ProbeResult = {
    provider,
    modelValue,
    capabilities: {
      text: false,
      vision: false,
      reasoning: false,
      toolUse: false,
      json: false,
      audio: false,
    },
    errors: [],
  }

  // Probe each capability
  result.capabilities.text = await probeTextCapability(model)
  console.log(`  ✓ Text: ${result.capabilities.text}`)

  result.capabilities.vision = await probeVisionCapability(model)
  console.log(`  ✓ Vision: ${result.capabilities.vision}`)

  result.capabilities.toolUse = await probeToolUseCapability(model)
  console.log(`  ✓ Tool Use: ${result.capabilities.toolUse}`)

  result.capabilities.json = await probeJsonCapability(model)
  console.log(`  ✓ JSON: ${result.capabilities.json}`)

  result.capabilities.reasoning = await probeReasoningCapability(model, modelValue)
  console.log(`  ✓ Reasoning: ${result.capabilities.reasoning}`)

  result.capabilities.audio = await probeAudioCapability(model)
  console.log(`  ✓ Audio: ${result.capabilities.audio}`)

  return result
}

async function main() {
  console.log('🚀 Starting model capability probe...\n')
  console.log('This script will test various models for their capabilities.')
  console.log('Make sure you have set up your API keys in .dev.vars\n')

  const results: ProbeResult[] = []

  // Example models to probe
  const modelsToProbe = [
    { provider: 'openai', value: 'gpt-4-turbo', model: openai('gpt-4-turbo') },
    { provider: 'openai', value: 'gpt-4o', model: openai('gpt-4o') },
    { provider: 'openai', value: 'gpt-4o-mini', model: openai('gpt-4o-mini') },
    { provider: 'anthropic', value: 'claude-3-5-sonnet-20241022', model: anthropic('claude-3-5-sonnet-20241022') },
    { provider: 'google', value: 'gemini-2.0-flash', model: google('gemini-2.0-flash') },
  ]

  for (const { provider, value, model } of modelsToProbe) {
    try {
      const result = await probeModel(provider, value, model)
      results.push(result)
    }
    catch (error: any) {
      console.error(`❌ Failed to probe ${provider}/${value}:`, error.message)
      results.push({
        provider,
        modelValue: value,
        capabilities: {
          text: false,
          vision: false,
          reasoning: false,
          toolUse: false,
          json: false,
          audio: false,
        },
        errors: [error.message],
      })
    }

    // Rate limit delay
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  // Print summary
  console.log('\n\n📊 Probe Results Summary:\n')
  console.log('Update packages/shared/src/capabilities.ts with these results:\n')

  for (const result of results) {
    console.log(`'${result.provider}/${result.modelValue}': {`)
    console.log(`  contextWindow: 128000, // TODO: Verify this value`)
    console.log(`  capabilities: {`)
    console.log(`    text: ${result.capabilities.text},`)
    if (result.capabilities.vision)
      console.log(`    vision: ${result.capabilities.vision},`)
    if (result.capabilities.reasoning)
      console.log(`    reasoning: ${result.capabilities.reasoning},`)
    if (result.capabilities.toolUse)
      console.log(`    toolUse: ${result.capabilities.toolUse},`)
    if (result.capabilities.json)
      console.log(`    json: ${result.capabilities.json},`)
    if (result.capabilities.audio)
      console.log(`    audio: ${result.capabilities.audio},`)
    console.log(`  },`)
    console.log(`},\n`)
  }

  console.log('\n✅ Probe complete!')
}

main().catch(console.error)
