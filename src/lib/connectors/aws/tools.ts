import { tool } from 'ai';
import { z } from 'zod';
import { AWSClient } from './client';
import type { ToolSet } from '../types';

export function createAWSTools(client: AWSClient): ToolSet {
  const aws_list_log_groups = tool({
    description:
      'List CloudWatch log groups. Optionally filter by prefix to find specific application logs.',
    inputSchema: z.object({
      prefix: z
        .string()
        .optional()
        .describe('Log group name prefix to filter by (e.g., "/aws/lambda/my-function")'),
    }),
    execute: async ({ prefix }) => {
      const logGroups = await client.listLogGroups(prefix);

      return logGroups.map((lg) => ({
        name: lg.logGroupName,
        storedBytes: lg.storedBytes,
        retentionInDays: lg.retentionInDays,
        createdAt: lg.creationTime ? new Date(lg.creationTime).toISOString() : undefined,
        arn: lg.arn,
      }));
    },
  });

  const aws_search_logs = tool({
    description:
      'Search CloudWatch logs for a specific log group using a filter pattern. Returns matching log events.',
    inputSchema: z.object({
      logGroupName: z
        .string()
        .describe('The name of the log group to search (e.g., "/aws/lambda/my-function")'),
      filterPattern: z
        .string()
        .describe(
          'CloudWatch filter pattern (e.g., "ERROR", "{ $.level = \\"error\\" }", "?ERROR ?Exception")'
        ),
      startTime: z
        .number()
        .optional()
        .describe('Start time as Unix timestamp in milliseconds. Defaults to 1 hour ago.'),
      endTime: z
        .number()
        .optional()
        .describe('End time as Unix timestamp in milliseconds. Defaults to now.'),
      limit: z.number().optional().default(50).describe('Maximum number of log events to return'),
    }),
    execute: async ({ logGroupName, filterPattern, startTime, endTime, limit }) => {
      const now = Date.now();
      const events = await client.searchLogs(logGroupName, filterPattern, {
        startTime: startTime ?? now - 3600000, // Default: 1 hour ago
        endTime: endTime ?? now,
        limit,
      });

      return events.map((event) => ({
        timestamp: event.timestamp ? new Date(event.timestamp).toISOString() : undefined,
        message: event.message,
        logStreamName: event.logStreamName,
      }));
    },
  });

  const aws_list_pipelines = tool({
    description: 'List all CodePipeline pipelines in the configured AWS region.',
    inputSchema: z.object({}),
    execute: async () => {
      const pipelines = await client.listPipelines();

      return pipelines.map((p) => ({
        name: p.name,
        version: p.version,
        created: p.created?.toISOString(),
        updated: p.updated?.toISOString(),
      }));
    },
  });

  const aws_get_pipeline_status = tool({
    description:
      'Get the current execution status of a CodePipeline, including the status of each stage.',
    inputSchema: z.object({
      pipelineName: z.string().describe('The name of the CodePipeline'),
    }),
    execute: async ({ pipelineName }) => {
      const status = await client.getPipelineStatus(pipelineName);

      return {
        pipelineName: status.pipelineName,
        stages: status.stages.map((stage) => ({
          stageName: stage.stageName,
          status: stage.latestExecution?.status,
          pipelineExecutionId: stage.latestExecution?.pipelineExecutionId,
          actions: stage.actionStates?.map((action) => ({
            actionName: action.actionName,
            status: action.latestExecution?.status,
            summary: action.latestExecution?.summary,
            lastStatusChange: action.latestExecution?.lastStatusChange?.toISOString(),
            externalExecutionUrl: action.latestExecution?.externalExecutionUrl,
          })),
        })),
      };
    },
  });

  const aws_get_build_status = tool({
    description: 'Get recent build status for a CodeBuild project.',
    inputSchema: z.object({
      projectName: z.string().describe('The name of the CodeBuild project'),
      limit: z.number().optional().default(5).describe('Number of recent builds to return'),
    }),
    execute: async ({ projectName, limit }) => {
      const builds = await client.getBuildStatus(projectName, limit);

      return builds.map((build) => ({
        id: build.id,
        buildNumber: build.buildNumber,
        status: build.buildStatus,
        startTime: build.startTime?.toISOString(),
        endTime: build.endTime?.toISOString(),
        sourceVersion: build.sourceVersion,
        initiator: build.initiator,
        phases:
          build.phases?.map((phase) => ({
            phaseType: phase.phaseType,
            phaseStatus: phase.phaseStatus,
            durationInSeconds: phase.durationInSeconds,
          })) ?? [],
        logs: build.logs
          ? {
              deepLink: build.logs.deepLink,
              cloudWatchLogsArn: build.logs.cloudWatchLogsArn,
            }
          : undefined,
      }));
    },
  });

  const aws_describe_ecs_services = tool({
    description:
      'Get ECS service status for a cluster. Shows running tasks, desired count, and deployment status.',
    inputSchema: z.object({
      clusterName: z
        .string()
        .describe('The name or ARN of the ECS cluster (e.g., "my-cluster" or full ARN)'),
      serviceName: z
        .string()
        .optional()
        .describe('Specific service name to describe. If omitted, lists all services in cluster.'),
    }),
    execute: async ({ clusterName, serviceName }) => {
      const services = await client.describeECSServices(clusterName, serviceName);

      return services.map((service) => ({
        serviceName: service.serviceName,
        status: service.status,
        desiredCount: service.desiredCount,
        runningCount: service.runningCount,
        pendingCount: service.pendingCount,
        taskDefinition: service.taskDefinition,
        launchType: service.launchType,
        deployments: service.deployments?.map((d) => ({
          id: d.id,
          status: d.status,
          taskDefinition: d.taskDefinition,
          desiredCount: d.desiredCount,
          runningCount: d.runningCount,
          pendingCount: d.pendingCount,
          createdAt: d.createdAt?.toISOString(),
          updatedAt: d.updatedAt?.toISOString(),
          rolloutState: d.rolloutState,
        })),
        events: service.events?.slice(0, 5).map((e) => ({
          createdAt: e.createdAt?.toISOString(),
          message: e.message,
        })),
      }));
    },
  });

  const aws_get_lambda_status = tool({
    description: 'Get details about a Lambda function including runtime, memory, and last modified.',
    inputSchema: z.object({
      functionName: z
        .string()
        .describe('The name or ARN of the Lambda function (e.g., "my-function" or full ARN)'),
    }),
    execute: async ({ functionName }) => {
      const fn = await client.getLambdaStatus(functionName);

      return {
        functionName: fn.FunctionName,
        functionArn: fn.FunctionArn,
        runtime: fn.Runtime,
        handler: fn.Handler,
        codeSize: fn.CodeSize,
        description: fn.Description,
        timeout: fn.Timeout,
        memorySize: fn.MemorySize,
        lastModified: fn.LastModified,
        state: fn.State,
        stateReason: fn.StateReason,
        version: fn.Version,
        environment: fn.Environment?.Variables
          ? Object.keys(fn.Environment.Variables).length
          : 0,
        consoleUrl: `https://${client.region}.console.aws.amazon.com/lambda/home?region=${client.region}#/functions/${fn.FunctionName}`,
      };
    },
  });

  return {
    aws_list_log_groups,
    aws_search_logs,
    aws_list_pipelines,
    aws_get_pipeline_status,
    aws_get_build_status,
    aws_describe_ecs_services,
    aws_get_lambda_status,
  };
}
