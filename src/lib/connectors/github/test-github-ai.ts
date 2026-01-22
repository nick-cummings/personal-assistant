/**
 * AI Tool Usage Test Script for GitHub Connector
 *
 * This script tests that an AI assistant correctly uses GitHub tools
 * by simulating prompts and verifying tool calls.
 *
 * Usage:
 *   GITHUB_TOKEN=xxx bun run src/lib/connectors/github/test-github-ai.ts
 */

import Anthropic from '@anthropic-ai/sdk';
import { GitHubClient } from './client';
import { createGitHubTools } from './tools';

const config = {
  token: process.env.GITHUB_TOKEN || process.env.GITHUB_PAT || '',
  defaultOwner: process.env.GITHUB_DEFAULT_OWNER || process.env.GITHUB_OWNER || '',
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
const GITHUB_TOOL_SCHEMAS: Record<
  string,
  { description: string; properties: Record<string, unknown>; required: string[] }
> = {
  github_list_prs: {
    description:
      'List pull requests for a GitHub repository. Returns PR numbers, titles, authors, status, and links. Use github_get_pr with the PR number to get full details including description and changes.',
    properties: {
      repo: {
        type: 'string',
        description:
          'Repository in format "owner/repo" (e.g., "facebook/react", "microsoft/typescript"). If no owner provided, uses default owner from config.',
      },
      state: {
        type: 'string',
        enum: ['open', 'closed', 'all'],
        description: 'Filter by PR state: "open" (default), "closed", or "all"',
      },
      author: {
        type: 'string',
        description: 'Filter by author GitHub username (e.g., "octocat")',
      },
    },
    required: ['repo'],
  },
  github_get_pr: {
    description:
      'Get detailed information about a specific pull request including full description, file changes, additions/deletions counts, and merge status. Use github_list_prs first to find PR numbers.',
    properties: {
      repo: {
        type: 'string',
        description:
          'Repository in format "owner/repo" (e.g., "facebook/react"). Get this from github_list_prs results.',
      },
      prNumber: {
        type: 'number',
        description:
          'Pull request number (e.g., 123, 456). Get this from github_list_prs or github_search_issues results.',
      },
    },
    required: ['repo', 'prNumber'],
  },
  github_get_pr_comments: {
    description:
      'Get all comments and code reviews on a pull request. Returns both issue-style comments and code review feedback. Use github_list_prs or github_get_pr first to get the PR number.',
    properties: {
      repo: {
        type: 'string',
        description:
          'Repository in format "owner/repo" (e.g., "facebook/react"). Get this from github_list_prs results.',
      },
      prNumber: {
        type: 'number',
        description:
          'Pull request number (e.g., 123). Get this from github_list_prs or github_search_issues results.',
      },
    },
    required: ['repo', 'prNumber'],
  },
  github_list_actions_runs: {
    description:
      'List GitHub Actions workflow runs for a repository. Shows CI/CD pipeline status, which commits triggered runs, and run outcomes. Use github_get_actions_run with the run ID for more details.',
    properties: {
      repo: {
        type: 'string',
        description: 'Repository in format "owner/repo" (e.g., "facebook/react", "vercel/next.js")',
      },
      workflow: {
        type: 'string',
        description:
          'Filter by workflow file name (e.g., "ci.yml", "tests.yaml", "build.yml"). Omit to see all workflows.',
      },
      status: {
        type: 'string',
        enum: ['queued', 'in_progress', 'completed'],
        description: 'Filter by run status: "queued", "in_progress", or "completed"',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of runs to return (default: 10, max: 100)',
      },
    },
    required: ['repo'],
  },
  github_get_actions_run: {
    description:
      'Get detailed information about a specific GitHub Actions workflow run. Shows full status, timing, commit details, and result. Use github_list_actions_runs first to get run IDs.',
    properties: {
      repo: {
        type: 'string',
        description:
          'Repository in format "owner/repo" (e.g., "facebook/react"). Get this from github_list_actions_runs results.',
      },
      runId: {
        type: 'number',
        description:
          'Workflow run ID (e.g., 1234567890). Get this from github_list_actions_runs results.',
      },
    },
    required: ['repo', 'runId'],
  },
  github_search_issues: {
    description:
      'Search GitHub issues and pull requests across repositories using GitHub search syntax. Returns matching items with type (issue or PR), status, and links. Use github_get_pr with the number for PR details.',
    properties: {
      query: {
        type: 'string',
        description:
          'GitHub search query. Examples: "is:pr is:open author:octocat" (open PRs by user), "repo:facebook/react is:issue is:open label:bug" (open bugs in repo)',
      },
    },
    required: ['query'],
  },
};

// Convert our tools to Anthropic format
function convertToolsToAnthropicFormat(tools: ReturnType<typeof createGitHubTools>) {
  return Object.keys(tools).map((name) => {
    const schema = GITHUB_TOOL_SCHEMAS[name];
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
  tools: ReturnType<typeof createGitHubTools>,
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
        'You are a helpful assistant with access to GitHub tools. Use the tools to help the user find and manage pull requests, issues, and workflow runs. Always use the appropriate tool when asked about GitHub repositories.',
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
          'You are a helpful assistant with access to GitHub tools. Use the tools to help the user find and manage pull requests, issues, and workflow runs. Always use the appropriate tool when asked about GitHub repositories.',
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
  console.log('=== GitHub AI Tool Usage Tests ===\n');

  if (!config.token) {
    console.error('Error: Missing credentials');
    console.error('Set GITHUB_TOKEN environment variable');
    process.exit(1);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: Missing ANTHROPIC_API_KEY environment variable');
    process.exit(1);
  }

  const client = new GitHubClient(config);
  const tools = createGitHubTools(client);
  const anthropicTools = convertToolsToAnthropicFormat(tools);
  const anthropic = new Anthropic();

  console.log('Tools available:', Object.keys(tools).join(', '));

  const tests = [
    {
      name: 'Test 1: List open pull requests',
      prompt: 'Show me the open pull requests on facebook/react',
      expectedTools: ['github_list_prs'],
    },
    {
      name: 'Test 2: Search for issues',
      prompt: 'Search for open bugs in the React repository',
      expectedTools: ['github_search_issues'],
    },
    {
      name: 'Test 3: List workflow runs',
      prompt: 'What are the recent CI/CD pipeline runs for facebook/react?',
      expectedTools: ['github_list_actions_runs'],
    },
    {
      name: 'Test 4: List PRs then get details',
      prompt:
        'Find an open PR on facebook/react and show me its full description and how many files it changes',
      expectedTools: ['github_list_prs', 'github_get_pr'],
    },
    {
      name: 'Test 5: Search and get PR comments',
      prompt: 'Find a recent pull request on facebook/react and show me the code review feedback',
      expectedTools: ['github_list_prs', 'github_get_pr_comments'],
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
