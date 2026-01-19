import { createAnthropic } from '@ai-sdk/anthropic';

// Create Anthropic client using the AI SDK
export const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Model IDs that can be used
export const MODELS = {
  'claude-sonnet-4-20250514': anthropic('claude-sonnet-4-20250514'),
  'claude-opus-4-20250514': anthropic('claude-opus-4-20250514'),
  'claude-3-5-haiku-20241022': anthropic('claude-3-5-haiku-20241022'),
} as const;

export type ModelId = keyof typeof MODELS;

export function getModel(modelId: string) {
  if (modelId in MODELS) {
    return MODELS[modelId as ModelId];
  }
  // Default to Sonnet if invalid model
  return MODELS['claude-sonnet-4-20250514'];
}
