/**
 * AI Tool Usage Test Script for Confluence Connector
 *
 * This script tests that an AI assistant correctly uses Confluence tools
 * by simulating prompts and verifying tool calls.
 *
 * Usage:
 *   CONFLUENCE_HOST=xxx CONFLUENCE_EMAIL=xxx CONFLUENCE_API_TOKEN=xxx bun run src/lib/connectors/confluence/test-confluence-ai.ts
 */

import Anthropic from '@anthropic-ai/sdk';
import { ConfluenceClient } from './client';
import { createConfluenceTools } from './tools';

// Support both CONFLUENCE_HOST and CONFLUENCE_BASE_URL (extract host from URL if needed)
function getHost(): string {
  if (process.env.CONFLUENCE_HOST) {
    return process.env.CONFLUENCE_HOST;
  }
  if (process.env.CONFLUENCE_BASE_URL) {
    // Extract host from URL like "https://nick-cummings.atlassian.net/wiki"
    const url = process.env.CONFLUENCE_BASE_URL;
    const match = url.match(/https?:\/\/([^\/]+)/);
    return match ? match[1] : url;
  }
  return '';
}

const config = {
  host: getHost(),
  email: process.env.CONFLUENCE_EMAIL || '',
  apiToken: process.env.CONFLUENCE_API_TOKEN || '',
};

interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface TextBlock {
  type: 'text';
  text: string;
}

type ContentBlock = ToolUseBlock | TextBlock;

// Manually define tool schemas for Anthropic API
const CONFLUENCE_TOOL_SCHEMAS: Record<
  string,
  { description: string; properties: Record<string, unknown>; required: string[] }
> = {
  confluence_list_spaces: {
    description:
      'List available Confluence spaces that the user has access to. Returns space ID, key, name, and URL. Use the space key with confluence_search to filter searches to a specific space.',
    properties: {},
    required: [],
  },
  confluence_search: {
    description:
      'Search Confluence pages and content using text search. Returns matching pages with their IDs, titles, space keys, excerpts, and URLs. Use the page ID with confluence_get_page to retrieve the full content.',
    properties: {
      query: {
        type: 'string',
        description:
          'Search query text to find pages. Examples: "deployment guide", "API documentation", "onboarding process"',
      },
      spaceKey: {
        type: 'string',
        description:
          'Optional: Limit search to a specific space key (e.g., "DEV", "OPS", "HR"). Use confluence_list_spaces to find available space keys.',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return (default: 10)',
      },
    },
    required: ['query'],
  },
  confluence_get_page: {
    description:
      'Get the full content of a Confluence page by its ID. Returns the page title, content (as plain text), version info, and URLs. Use confluence_search first to find page IDs.',
    properties: {
      pageId: {
        type: 'string',
        description:
          'The numeric ID of the page to retrieve, as returned by confluence_search (e.g., "123456789")',
      },
    },
    required: ['pageId'],
  },
  confluence_get_page_children: {
    description:
      'Get child pages of a specific Confluence page. Useful for navigating page hierarchies. Returns page IDs, titles, and URLs of all direct children.',
    properties: {
      pageId: {
        type: 'string',
        description: 'The numeric ID of the parent page whose children you want to list',
      },
    },
    required: ['pageId'],
  },
  confluence_list_drafts: {
    description:
      'List draft (unpublished) pages in Confluence. Drafts are pages that have been created but not yet published. Returns page IDs, titles, space keys, and URLs. Note: Uses deprecated REST API v1 as v2 does not support draft pages.',
    properties: {
      spaceKey: {
        type: 'string',
        description:
          'Optional: Limit to drafts in a specific space key (e.g., "DEV", "OPS"). Use confluence_list_spaces to find available space keys.',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return (default: 20)',
      },
    },
    required: [],
  },
};

// Convert our tools to Anthropic format
function convertToolsToAnthropicFormat(tools: ReturnType<typeof createConfluenceTools>) {
  return Object.keys(tools).map((name) => {
    const schema = CONFLUENCE_TOOL_SCHEMAS[name];
    return {
      name,
      description: schema.description,
      input_schema: {
        type: 'object' as const,
        properties: schema.properties,
        required: schema.required,
      },
    };
  });
}

async function runTest(
  testName: string,
  prompt: string,
  expectedToolCalls: string[],
  anthropic: Anthropic,
  tools: ReturnType<typeof createConfluenceTools>,
  anthropicTools: ReturnType<typeof convertToolsToAnthropicFormat>
): Promise<{ passed: boolean; details: string }> {
  console.log(`\n--- ${testName} ---`);
  console.log(`Prompt: "${prompt}"`);

  try {
    const messages: Anthropic.MessageParam[] = [{ role: 'user', content: prompt }];

    // First API call to get tool use
    let response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system:
        'You are a helpful assistant with access to Confluence tools. Use the tools to help the user find and read documentation. Always use the appropriate tool when asked about Confluence pages or documentation.',
      tools: anthropicTools,
      messages,
    });

    const toolCalls: string[] = [];
    let iterations = 0;
    const maxIterations = 5;

    // Process tool calls in a loop until we get a final response
    while (response.stop_reason === 'tool_use' && iterations < maxIterations) {
      iterations++;

      // Find all tool use blocks
      const toolUseBlocks = response.content.filter(
        (block): block is ToolUseBlock => block.type === 'tool_use'
      );

      // Process each tool call
      const toolResults: Anthropic.MessageParam['content'] = [];

      for (const toolUse of toolUseBlocks) {
        toolCalls.push(toolUse.name);
        console.log(`  Tool called: ${toolUse.name}`);
        console.log(`  Input: ${JSON.stringify(toolUse.input)}`);

        // Execute the actual tool
        const tool = tools[toolUse.name as keyof typeof tools];
        if (tool) {
          const execute = (
            tool as { execute: (input: Record<string, unknown>) => Promise<unknown> }
          ).execute;
          const result = await execute(toolUse.input);
          console.log(
            `  Result preview: ${JSON.stringify(result).substring(0, 200)}${JSON.stringify(result).length > 200 ? '...' : ''}`
          );

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify(result),
          });
        }
      }

      // Add assistant message and tool results to conversation
      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: toolResults });

      // Get next response
      response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system:
          'You are a helpful assistant with access to Confluence tools. Use the tools to help the user find and read documentation. Always use the appropriate tool when asked about Confluence pages or documentation.',
        tools: anthropicTools,
        messages,
      });
    }

    // Check if expected tools were called
    const allExpectedCalled = expectedToolCalls.every((expected) => toolCalls.includes(expected));

    // Get final text response
    const textBlocks = response.content.filter(
      (block): block is TextBlock => block.type === 'text'
    );
    const finalResponse = textBlocks.map((b) => b.text).join('\n');
    console.log(`  Final response preview: ${finalResponse.substring(0, 150)}...`);

    if (allExpectedCalled) {
      console.log(`  PASSED - Called expected tools: ${toolCalls.join(', ')}`);
      return { passed: true, details: `Called: ${toolCalls.join(', ')}` };
    } else {
      console.log(
        `  FAILED - Expected: ${expectedToolCalls.join(', ')}, Got: ${toolCalls.join(', ')}`
      );
      return {
        passed: false,
        details: `Expected: ${expectedToolCalls.join(', ')}, Got: ${toolCalls.join(', ')}`,
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log(`  ERROR: ${message}`);
    return { passed: false, details: `Error: ${message}` };
  }
}

async function main() {
  console.log('=== Confluence AI Tool Usage Tests ===\n');

  if (!config.host || !config.email || !config.apiToken) {
    console.error('Error: Missing credentials');
    console.error(
      'Set CONFLUENCE_HOST, CONFLUENCE_EMAIL, and CONFLUENCE_API_TOKEN environment variables'
    );
    process.exit(1);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: Missing ANTHROPIC_API_KEY environment variable');
    process.exit(1);
  }

  const client = new ConfluenceClient(config);
  const tools = createConfluenceTools(client);
  const anthropicTools = convertToolsToAnthropicFormat(tools);
  const anthropic = new Anthropic();

  console.log('Tools available:', Object.keys(tools).join(', '));

  const tests = [
    {
      name: 'Test 1: List available spaces',
      prompt: 'What Confluence spaces do I have access to?',
      expectedTools: ['confluence_list_spaces'],
    },
    {
      name: 'Test 2: Search for documentation',
      prompt: 'Search Confluence for documentation about deployment',
      expectedTools: ['confluence_search'],
    },
    {
      name: 'Test 3: Search then get page content',
      prompt: 'Find a page about onboarding in Confluence and show me its full content',
      expectedTools: ['confluence_search', 'confluence_get_page'],
    },
    {
      name: 'Test 4: General documentation query',
      prompt: 'I need to find the API documentation in Confluence',
      expectedTools: ['confluence_search'],
    },
    {
      name: 'Test 5: List draft pages',
      prompt: 'Show me all my unpublished draft pages in Confluence',
      expectedTools: ['confluence_list_drafts'],
    },
  ];

  const results: { name: string; passed: boolean; details: string }[] = [];

  for (const test of tests) {
    const result = await runTest(
      test.name,
      test.prompt,
      test.expectedTools,
      anthropic,
      tools,
      anthropicTools
    );
    results.push({ name: test.name, ...result });

    // Small delay between tests to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Summary
  console.log('\n=== Test Summary ===');
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  console.log(`Passed: ${passed}/${total}`);

  for (const result of results) {
    const status = result.passed ? 'PASS' : 'FAIL';
    console.log(`  [${status}] ${result.name}`);
    if (!result.passed) {
      console.log(`         ${result.details}`);
    }
  }

  if (passed < total) {
    process.exit(1);
  }
}

main().catch(console.error);
