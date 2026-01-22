/**
 * AI Tool Usage Test Script for Jira Connector
 *
 * This script tests that an AI assistant correctly uses Jira tools
 * by simulating prompts and verifying tool calls.
 *
 * Usage:
 *   JIRA_HOST=xxx JIRA_EMAIL=xxx JIRA_API_TOKEN=xxx bun run src/lib/connectors/jira/test-jira-ai.ts
 */

import Anthropic from '@anthropic-ai/sdk';
import { JiraClient } from './client';
import { createJiraTools } from './tools';

// Support JIRA_HOST, JIRA_BASE_URL, or fallback to CONFLUENCE_BASE_URL (same Atlassian instance)
function getHost(): string {
  if (process.env.JIRA_HOST) {
    return process.env.JIRA_HOST;
  }
  if (process.env.JIRA_BASE_URL) {
    const url = process.env.JIRA_BASE_URL;
    const match = url.match(/https?:\/\/([^\/]+)/);
    return match ? match[1] : url;
  }
  // Fallback to Confluence host (same Atlassian instance)
  if (process.env.CONFLUENCE_BASE_URL) {
    const url = process.env.CONFLUENCE_BASE_URL;
    const match = url.match(/https?:\/\/([^\/]+)/);
    return match ? match[1] : url;
  }
  if (process.env.CONFLUENCE_HOST) {
    return process.env.CONFLUENCE_HOST;
  }
  return '';
}

const config = {
  host: getHost(),
  // Jira and Confluence use the same Atlassian credentials
  email:
    process.env.JIRA_EMAIL ||
    process.env.CONFLUENCE_EMAIL ||
    process.env.ATLASSIAN_EMAIL ||
    process.env.ATTLASSIAN_EMAIL || // typo variant
    '',
  apiToken:
    process.env.JIRA_API_TOKEN ||
    process.env.CONFLUENCE_API_TOKEN ||
    process.env.ATLASSIAN_API_TOKEN ||
    process.env.ATTLASSIAN_API_TOKEN || // typo variant
    '',
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
const JIRA_TOOL_SCHEMAS: Record<
  string,
  { description: string; properties: Record<string, unknown>; required: string[] }
> = {
  jira_search_issues: {
    description:
      'Search Jira issues using JQL (Jira Query Language). Returns issue keys (like "PROJ-123"), summaries, status, priority, and assignees. Use jira_get_issue with the issue key to get full details including description.',
    properties: {
      jql: {
        type: 'string',
        description:
          'JQL query string. Examples: "assignee = currentUser() AND status != Done" (my open issues), "project = PROJ AND sprint in openSprints()" (current sprint), "status = \\"In Progress\\"" (issues in progress)',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return (default: 20)',
      },
    },
    required: ['jql'],
  },
  jira_get_issue: {
    description:
      'Get detailed information about a specific Jira issue by its key. Returns the full description, comments count, status, priority, assignee, and other details. Use jira_search_issues first to find issue keys.',
    properties: {
      issueKey: {
        type: 'string',
        description:
          'The issue key in the format "PROJECT-NUMBER" (e.g., "PROJ-123", "DEV-456", "BUG-789"). Get this from jira_search_issues results.',
      },
    },
    required: ['issueKey'],
  },
  jira_get_issue_comments: {
    description:
      'Get all comments on a specific Jira issue. Returns the comment authors, content, and timestamps. Use jira_search_issues or jira_get_issue first to get the issue key.',
    properties: {
      issueKey: {
        type: 'string',
        description:
          'The issue key in the format "PROJECT-NUMBER" (e.g., "PROJ-123"). Get this from jira_search_issues results.',
      },
    },
    required: ['issueKey'],
  },
  jira_list_boards: {
    description:
      'List all available Jira boards (Scrum and Kanban boards). Returns board IDs, names, types, and associated projects. Use the board ID with jira_get_sprint to get active sprint information.',
    properties: {},
    required: [],
  },
  jira_get_sprint: {
    description:
      'Get the active sprint for a specific board, including all sprint issues grouped by status. Use jira_list_boards first to get board IDs. Only works for Scrum boards (not Kanban).',
    properties: {
      boardId: {
        type: 'number',
        description:
          'The numeric board ID as returned by jira_list_boards (e.g., 1, 42, 123). Only Scrum boards have sprints.',
      },
    },
    required: ['boardId'],
  },
  jira_list_projects: {
    description:
      'List all Jira projects the user has access to. Returns project keys (used in JQL queries and issue keys), names, and types. Use project keys with jira_search_issues to filter by project.',
    properties: {},
    required: [],
  },
};

// Convert our tools to Anthropic format
function convertToolsToAnthropicFormat(tools: ReturnType<typeof createJiraTools>) {
  return Object.keys(tools).map((name) => {
    const schema = JIRA_TOOL_SCHEMAS[name];
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
  tools: ReturnType<typeof createJiraTools>,
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
        'You are a helpful assistant with access to Jira tools. Use the tools to help the user find and manage issues. Always use the appropriate tool when asked about Jira issues, projects, or sprints.',
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
          'You are a helpful assistant with access to Jira tools. Use the tools to help the user find and manage issues. Always use the appropriate tool when asked about Jira issues, projects, or sprints.',
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
  console.log('=== Jira AI Tool Usage Tests ===\n');

  if (!config.host || !config.email || !config.apiToken) {
    console.error('Error: Missing credentials');
    console.error('Set JIRA_HOST, JIRA_EMAIL, and JIRA_API_TOKEN environment variables');
    process.exit(1);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: Missing ANTHROPIC_API_KEY environment variable');
    process.exit(1);
  }

  const client = new JiraClient(config);
  const tools = createJiraTools(client);
  const anthropicTools = convertToolsToAnthropicFormat(tools);
  const anthropic = new Anthropic();

  console.log('Tools available:', Object.keys(tools).join(', '));

  const tests = [
    {
      name: 'Test 1: List available projects',
      prompt: 'What Jira projects do I have access to?',
      expectedTools: ['jira_list_projects'],
    },
    {
      name: 'Test 2: Search for issues',
      prompt: 'Show me the most recent issues in Jira',
      expectedTools: ['jira_search_issues'],
    },
    {
      name: 'Test 3: List boards',
      prompt: 'What Jira boards are available?',
      expectedTools: ['jira_list_boards'],
    },
    {
      name: 'Test 4: Search then get issue details',
      prompt: 'Find the most recent Jira issue and show me its full details including description',
      expectedTools: ['jira_search_issues', 'jira_get_issue'],
    },
    {
      name: 'Test 5: Get issue comments',
      prompt: 'Find a recent issue and show me its comments',
      expectedTools: ['jira_search_issues', 'jira_get_issue_comments'],
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
