/**
 * AI Tool Usage Test Script for AWS Connector
 *
 * This script tests that an AI assistant correctly uses AWS tools
 * by simulating prompts and verifying tool calls.
 *
 * Usage:
 *   AWS_ACCESS_KEY_ID=xxx AWS_SECRET_ACCESS_KEY=xxx AWS_REGION=us-east-1 bun run src/lib/connectors/aws/test-aws-ai.ts
 */

import Anthropic from '@anthropic-ai/sdk';
import { AWSClient } from './client';
import { createAWSTools } from './tools';

const config = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1',
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
const AWS_TOOL_SCHEMAS: Record<
  string,
  { description: string; properties: Record<string, unknown>; required: string[] }
> = {
  aws_list_log_groups: {
    description:
      'List CloudWatch log groups in AWS. Returns log group names, storage sizes, and retention settings. Use aws_search_logs with the log group name to search for specific log entries.',
    properties: {
      prefix: {
        type: 'string',
        description:
          'Log group name prefix to filter by. Examples: "/aws/lambda" (all Lambda logs), "/aws/ecs" (all ECS logs). Omit to list all log groups.',
      },
    },
    required: [],
  },
  aws_search_logs: {
    description:
      'Search CloudWatch logs for specific patterns in a log group. Returns matching log events with timestamps and messages. Use aws_list_log_groups first to find log group names.',
    properties: {
      logGroupName: {
        type: 'string',
        description:
          'The full name of the log group to search (e.g., "/aws/lambda/my-function"). Get this from aws_list_log_groups results.',
      },
      filterPattern: {
        type: 'string',
        description:
          'CloudWatch filter pattern. Examples: "ERROR" (simple text match), "{ $.level = \\"error\\" }" (JSON field match)',
      },
      startTime: {
        type: 'number',
        description: 'Start time as Unix timestamp in milliseconds. Defaults to 1 hour ago.',
      },
      endTime: {
        type: 'number',
        description: 'End time as Unix timestamp in milliseconds. Defaults to now.',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of log events to return (default: 50)',
      },
    },
    required: ['logGroupName', 'filterPattern'],
  },
  aws_list_pipelines: {
    description:
      'List all CodePipeline pipelines in the configured AWS region. Returns pipeline names and versions. Use aws_get_pipeline_status with the pipeline name to see execution status.',
    properties: {},
    required: [],
  },
  aws_get_pipeline_status: {
    description:
      'Get the current execution status of a CodePipeline, including the status of each stage and action. Use aws_list_pipelines first to find pipeline names.',
    properties: {
      pipelineName: {
        type: 'string',
        description: 'The name of the CodePipeline. Get this from aws_list_pipelines results.',
      },
    },
    required: ['pipelineName'],
  },
  aws_get_build_status: {
    description:
      'Get recent build status for a CodeBuild project. Shows build results, phases, and links to logs.',
    properties: {
      projectName: {
        type: 'string',
        description: 'The name of the CodeBuild project.',
      },
      limit: {
        type: 'number',
        description: 'Number of recent builds to return (default: 5)',
      },
    },
    required: ['projectName'],
  },
  aws_describe_ecs_services: {
    description:
      'Get ECS service status for a cluster. Shows running tasks, desired count, deployments, and recent events.',
    properties: {
      clusterName: {
        type: 'string',
        description: 'The name or ARN of the ECS cluster.',
      },
      serviceName: {
        type: 'string',
        description:
          'Specific service name to describe. If omitted, returns all services in the cluster.',
      },
    },
    required: ['clusterName'],
  },
  aws_get_lambda_status: {
    description:
      'Get details about a Lambda function including runtime, memory, timeout, and state.',
    properties: {
      functionName: {
        type: 'string',
        description: 'The name or ARN of the Lambda function.',
      },
    },
    required: ['functionName'],
  },
};

// Convert our tools to Anthropic format
function convertToolsToAnthropicFormat(tools: ReturnType<typeof createAWSTools>) {
  return Object.keys(tools).map((name) => {
    const schema = AWS_TOOL_SCHEMAS[name];
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
  tools: ReturnType<typeof createAWSTools>,
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
        'You are a helpful assistant with access to AWS tools. Use the tools to help the user monitor and manage their AWS infrastructure. Always use the appropriate tool when asked about AWS resources like logs, pipelines, Lambda functions, or ECS services.',
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
          'You are a helpful assistant with access to AWS tools. Use the tools to help the user monitor and manage their AWS infrastructure. Always use the appropriate tool when asked about AWS resources like logs, pipelines, Lambda functions, or ECS services.',
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
  console.log('=== AWS AI Tool Usage Tests ===\n');

  if (!config.accessKeyId || !config.secretAccessKey) {
    console.error('Error: Missing credentials');
    console.error('Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables');
    process.exit(1);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: Missing ANTHROPIC_API_KEY environment variable');
    process.exit(1);
  }

  const client = new AWSClient(config);
  const tools = createAWSTools(client);
  const anthropicTools = convertToolsToAnthropicFormat(tools);
  const anthropic = new Anthropic();

  console.log('Tools available:', Object.keys(tools).join(', '));
  console.log('Region:', config.region);

  const tests = [
    {
      name: 'Test 1: List log groups',
      prompt: 'Show me the CloudWatch log groups in my AWS account',
      expectedTools: ['aws_list_log_groups'],
    },
    {
      name: 'Test 2: List pipelines',
      prompt: 'What CodePipeline pipelines do I have?',
      expectedTools: ['aws_list_pipelines'],
    },
    {
      name: 'Test 3: List Lambda log groups',
      prompt: 'Show me the log groups for my Lambda functions',
      expectedTools: ['aws_list_log_groups'],
    },
    {
      name: 'Test 4: List log groups then search for errors',
      prompt: 'Find any errors in my CloudWatch logs from the last hour',
      expectedTools: ['aws_list_log_groups', 'aws_search_logs'],
    },
    {
      name: 'Test 5: List pipelines then get status',
      prompt: 'Check the status of my deployment pipelines',
      expectedTools: ['aws_list_pipelines', 'aws_get_pipeline_status'],
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
