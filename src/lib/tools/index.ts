// Generic tools that are always available (not tied to specific connectors)

import { tool } from 'ai';
import type { ToolSet } from '../connectors/types';
import { createCalculatorTool } from './calculator';
import { createDateTimeTool } from './datetime';
import { createWeatherTool } from './weather';
import { createWebFetchTool } from './web-fetch';
import { createWebSearchTool } from './web-search';

export interface GenericToolsConfig {
  // Web search configuration
  serpApiKey?: string;

  // Weather configuration
  openWeatherApiKey?: string;
}

export function createGenericTools(config: GenericToolsConfig = {}): ToolSet {
  const tools: ToolSet = {};

  // Always available tools (no API key required)
  Object.assign(tools, createDateTimeTool());
  Object.assign(tools, createCalculatorTool());
  Object.assign(tools, createWebFetchTool());

  // Conditionally available tools (require API keys)
  if (config.serpApiKey) {
    Object.assign(tools, createWebSearchTool(config.serpApiKey));
  }

  if (config.openWeatherApiKey) {
    Object.assign(tools, createWeatherTool(config.openWeatherApiKey));
  }

  return tools;
}

// Re-export individual tool creators for testing
export { createCalculatorTool } from './calculator';
export { createDateTimeTool } from './datetime';
export { createWeatherTool } from './weather';
export { createWebFetchTool } from './web-fetch';
export { createWebSearchTool } from './web-search';
