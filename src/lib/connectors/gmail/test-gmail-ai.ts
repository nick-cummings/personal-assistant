/**
 * AI Tool Usage Test Script for Gmail Connector
 *
 * This script tests that an AI assistant correctly uses Gmail tools
 * by simulating prompts and verifying tool calls.
 *
 * Usage:
 *   GMAIL_EMAIL=you@gmail.com GMAIL_APP_PASSWORD=xxxx bun run src/lib/connectors/gmail/test-gmail-ai.ts
 */

import Anthropic from '@anthropic-ai/sdk';
import { GmailImapClient } from './client';
import { createGmailTools } from './tools';

const config = {
  email: process.env.GMAIL_EMAIL || '',
  appPassword: process.env.GMAIL_APP_PASSWORD || '',
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
// This is simpler and more reliable than trying to extract from Zod
const GMAIL_TOOL_SCHEMAS: Record<
  string,
  { description: string; properties: Record<string, unknown>; required: string[] }
> = {
  gmail_search_emails: {
    description:
      'Search for emails in Gmail. Returns a list of emails with their numeric IDs, subjects, senders, dates, and snippets. Use the returned numeric ID (e.g., "46161") with gmail_get_email to retrieve the full email body.',
    properties: {
      query: {
        type: 'string',
        description:
          'Search query to find emails. Searches subject and body. Use empty string "" to get recent emails. Examples: "invoice", "from John", "meeting notes"',
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of emails to return (default: 20)',
      },
    },
    required: ['query'],
  },
  gmail_get_email: {
    description:
      'Get the full content of a specific email from Gmail, including the complete body text. IMPORTANT: You must first use gmail_search_emails or gmail_get_folder_emails to get valid numeric message IDs. The messageId must be a numeric string like "46161", not a base64 or alphanumeric ID.',
    properties: {
      messageId: {
        type: 'string',
        description:
          'The numeric ID of the email as returned by gmail_search_emails or gmail_get_folder_emails. Must be a numeric string like "46161" or "12345". Do NOT use alphanumeric IDs.',
      },
    },
    required: ['messageId'],
  },
  gmail_list_labels: {
    description:
      'List all mail folders and labels in Gmail (e.g., INBOX, Sent Mail, Drafts, custom labels). Returns the folder ID (use with gmail_get_folder_emails), name, total message count, and unread count for each folder.',
    properties: {},
    required: [],
  },
  gmail_get_folder_emails: {
    description:
      'Get emails from a specific Gmail folder or label. Returns emails with their numeric IDs (use with gmail_get_email to get full content). Use gmail_list_labels first to discover available folder IDs.',
    properties: {
      folderId: {
        type: 'string',
        description:
          'The folder ID to get emails from. Common values: "INBOX", "[Gmail]/Sent Mail", "[Gmail]/Drafts", "[Gmail]/Spam", "[Gmail]/Trash", "[Gmail]/All Mail", or custom label names like "Work" or "Personal"',
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of emails to return (default: 20)',
      },
    },
    required: ['folderId'],
  },
};

// Convert our tools to Anthropic format
function convertToolsToAnthropicFormat(tools: ReturnType<typeof createGmailTools>) {
  return Object.keys(tools).map((name) => {
    const schema = GMAIL_TOOL_SCHEMAS[name];
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
  tools: ReturnType<typeof createGmailTools>,
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
        'You are a helpful assistant with access to Gmail tools. Use the tools to help the user with their email requests. Always use the appropriate tool when asked about emails.',
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
          'You are a helpful assistant with access to Gmail tools. Use the tools to help the user with their email requests. Always use the appropriate tool when asked about emails.',
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
  console.log('=== Gmail AI Tool Usage Tests ===\n');

  if (!config.email || !config.appPassword) {
    console.error('Error: Missing credentials');
    console.error('Set GMAIL_EMAIL and GMAIL_APP_PASSWORD environment variables');
    process.exit(1);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: Missing ANTHROPIC_API_KEY environment variable');
    process.exit(1);
  }

  const client = new GmailImapClient(config);
  const tools = createGmailTools(client);
  const anthropicTools = convertToolsToAnthropicFormat(tools);
  const anthropic = new Anthropic();

  console.log('Tools available:', Object.keys(tools).join(', '));

  const tests = [
    {
      name: 'Test 1: Search for recent emails',
      prompt: 'Show me my recent emails',
      expectedTools: ['gmail_search_emails'],
    },
    {
      name: 'Test 2: Search with specific query',
      prompt: 'Find emails about invoices',
      expectedTools: ['gmail_search_emails'],
    },
    {
      name: 'Test 3: List folders/labels',
      prompt: 'What folders or labels do I have in my Gmail?',
      expectedTools: ['gmail_list_labels'],
    },
    {
      name: 'Test 4: Get emails from specific folder',
      prompt: 'Show me emails from my Sent folder',
      expectedTools: ['gmail_get_folder_emails'],
    },
    {
      name: 'Test 5: Search then get full email content',
      prompt: 'Find my most recent email and show me the full content',
      expectedTools: ['gmail_search_emails', 'gmail_get_email'],
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
