import { tool } from 'ai';
import { z } from 'zod';
import { AWSClient } from './client';
import type { ToolSet } from '../types';

export function createAWSTools(client: AWSClient): ToolSet {
  const aws_list_log_groups = tool({
    description:
      'List CloudWatch log groups in AWS. Returns log group names, storage sizes, and retention settings. Use aws_search_logs with the log group name to search for specific log entries.',
    inputSchema: z.object({
      prefix: z
        .string()
        .optional()
        .describe(
          'Log group name prefix to filter by. Examples: "/aws/lambda" (all Lambda logs), "/aws/ecs" (all ECS logs), "/aws/lambda/my-function" (specific function). Omit to list all log groups.'
        ),
    }),
    execute: async ({ prefix }) => {
      console.log('[AWS] aws_list_log_groups called with:', { prefix });

      if (!client.hasCredentials()) {
        console.log('[AWS] No credentials configured');
        return {
          error:
            'AWS not configured. Please add your Access Key ID, Secret Access Key, and Region in Settings → Connectors.',
        };
      }

      try {
        console.log('[AWS] Listing log groups with prefix:', prefix || '(all)');
        const logGroups = await client.listLogGroups(prefix);
        console.log('[AWS] Found', logGroups.length, 'log groups');

        return {
          count: logGroups.length,
          logGroups: logGroups.map((lg) => ({
            name: lg.logGroupName,
            storedBytes: lg.storedBytes,
            retentionInDays: lg.retentionInDays,
            createdAt: lg.creationTime ? new Date(lg.creationTime).toISOString() : undefined,
            arn: lg.arn,
          })),
        };
      } catch (error) {
        console.error('[AWS] List log groups error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message.includes('credentials') || message.includes('Credential')) {
          return {
            error:
              'AWS authentication failed. Please check your Access Key ID and Secret Access Key in Settings → Connectors.',
          };
        }
        if (message.includes('region') || message.includes('Region')) {
          return {
            error: `Invalid AWS region. Please check your region setting in Settings → Connectors.`,
          };
        }
        return {
          error: `Failed to list log groups: ${message}`,
        };
      }
    },
  });

  const aws_search_logs = tool({
    description:
      'Search CloudWatch logs for specific patterns in a log group. Returns matching log events with timestamps and messages. Use aws_list_log_groups first to find log group names.',
    inputSchema: z.object({
      logGroupName: z
        .string()
        .describe(
          'The full name of the log group to search (e.g., "/aws/lambda/my-function", "/ecs/my-service"). Get this from aws_list_log_groups results.'
        ),
      filterPattern: z
        .string()
        .describe(
          'CloudWatch filter pattern. Examples: "ERROR" (simple text match), "ERROR Exception" (both words), "?ERROR ?Exception" (either word), "{ $.level = \\"error\\" }" (JSON field match), "[ip, user, timestamp, request, status_code=5*, size]" (space-delimited with wildcard)'
        ),
      startTime: z
        .number()
        .optional()
        .describe('Start time as Unix timestamp in milliseconds. Defaults to 1 hour ago.'),
      endTime: z
        .number()
        .optional()
        .describe('End time as Unix timestamp in milliseconds. Defaults to now.'),
      limit: z
        .number()
        .optional()
        .default(50)
        .describe('Maximum number of log events to return (default: 50, max: 10000)'),
    }),
    execute: async ({ logGroupName, filterPattern, startTime, endTime, limit }) => {
      console.log('[AWS] aws_search_logs called with:', { logGroupName, filterPattern, startTime, endTime, limit });

      if (!client.hasCredentials()) {
        console.log('[AWS] No credentials configured');
        return {
          error:
            'AWS not configured. Please add your Access Key ID, Secret Access Key, and Region in Settings → Connectors.',
        };
      }

      try {
        const now = Date.now();
        const effectiveStartTime = startTime ?? now - 3600000; // Default: 1 hour ago
        const effectiveEndTime = endTime ?? now;
        console.log('[AWS] Searching logs in:', logGroupName, 'for pattern:', filterPattern);
        console.log('[AWS] Time range:', new Date(effectiveStartTime).toISOString(), 'to', new Date(effectiveEndTime).toISOString());

        const events = await client.searchLogs(logGroupName, filterPattern, {
          startTime: effectiveStartTime,
          endTime: effectiveEndTime,
          limit,
        });
        console.log('[AWS] Found', events.length, 'log events');

        return {
          count: events.length,
          timeRange: {
            start: new Date(effectiveStartTime).toISOString(),
            end: new Date(effectiveEndTime).toISOString(),
          },
          events: events.map((event) => ({
            timestamp: event.timestamp ? new Date(event.timestamp).toISOString() : undefined,
            message: event.message,
            logStreamName: event.logStreamName,
          })),
        };
      } catch (error) {
        console.error('[AWS] Search logs error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message.includes('credentials') || message.includes('Credential')) {
          return {
            error:
              'AWS authentication failed. Please check your Access Key ID and Secret Access Key in Settings → Connectors.',
          };
        }
        if (message.includes('ResourceNotFoundException') || message.includes('does not exist')) {
          return {
            error: `Log group "${logGroupName}" not found. Use aws_list_log_groups to find available log groups.`,
          };
        }
        if (message.includes('Invalid filter pattern')) {
          return {
            error: `Invalid filter pattern: ${message}. Check CloudWatch filter pattern syntax.`,
          };
        }
        return {
          error: `Failed to search logs: ${message}`,
        };
      }
    },
  });

  const aws_list_pipelines = tool({
    description:
      'List all CodePipeline pipelines in the configured AWS region. Returns pipeline names and versions. Use aws_get_pipeline_status with the pipeline name to see execution status and stage details.',
    inputSchema: z.object({}),
    execute: async () => {
      console.log('[AWS] aws_list_pipelines called');

      if (!client.hasCredentials()) {
        console.log('[AWS] No credentials configured');
        return {
          error:
            'AWS not configured. Please add your Access Key ID, Secret Access Key, and Region in Settings → Connectors.',
        };
      }

      try {
        console.log('[AWS] Listing CodePipeline pipelines in region:', client.region);
        const pipelines = await client.listPipelines();
        console.log('[AWS] Found', pipelines.length, 'pipelines');

        return {
          count: pipelines.length,
          region: client.region,
          pipelines: pipelines.map((p) => ({
            name: p.name,
            version: p.version,
            created: p.created?.toISOString(),
            updated: p.updated?.toISOString(),
          })),
        };
      } catch (error) {
        console.error('[AWS] List pipelines error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message.includes('credentials') || message.includes('Credential')) {
          return {
            error:
              'AWS authentication failed. Please check your Access Key ID and Secret Access Key in Settings → Connectors.',
          };
        }
        if (message.includes('AccessDenied')) {
          return {
            error: 'Access denied to CodePipeline. Your IAM user may need codepipeline:ListPipelines permission.',
          };
        }
        return {
          error: `Failed to list pipelines: ${message}`,
        };
      }
    },
  });

  const aws_get_pipeline_status = tool({
    description:
      'Get the current execution status of a CodePipeline, including the status of each stage and action. Shows if the pipeline is succeeding, failing, or in progress. Use aws_list_pipelines first to find pipeline names.',
    inputSchema: z.object({
      pipelineName: z
        .string()
        .describe(
          'The name of the CodePipeline (e.g., "my-app-pipeline", "production-deploy"). Get this from aws_list_pipelines results.'
        ),
    }),
    execute: async ({ pipelineName }) => {
      console.log('[AWS] aws_get_pipeline_status called with:', { pipelineName });

      if (!client.hasCredentials()) {
        console.log('[AWS] No credentials configured');
        return {
          error:
            'AWS not configured. Please add your Access Key ID, Secret Access Key, and Region in Settings → Connectors.',
        };
      }

      try {
        console.log('[AWS] Getting pipeline status for:', pipelineName);
        const status = await client.getPipelineStatus(pipelineName);
        console.log('[AWS] Got pipeline status with', status.stages.length, 'stages');

        return {
          pipelineName: status.pipelineName,
          stageCount: status.stages.length,
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
      } catch (error) {
        console.error('[AWS] Get pipeline status error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message.includes('credentials') || message.includes('Credential')) {
          return {
            error:
              'AWS authentication failed. Please check your Access Key ID and Secret Access Key in Settings → Connectors.',
          };
        }
        if (message.includes('PipelineNotFoundException') || message.includes('does not exist')) {
          return {
            error: `Pipeline "${pipelineName}" not found. Use aws_list_pipelines to find available pipelines.`,
          };
        }
        return {
          error: `Failed to get pipeline status: ${message}`,
        };
      }
    },
  });

  const aws_get_build_status = tool({
    description:
      'Get recent build status for a CodeBuild project. Shows build results, phases, and links to logs. Useful for checking CI/CD build history.',
    inputSchema: z.object({
      projectName: z
        .string()
        .describe(
          'The name of the CodeBuild project (e.g., "my-app-build", "frontend-tests"). This is the project name, not the build ID.'
        ),
      limit: z
        .number()
        .optional()
        .default(5)
        .describe('Number of recent builds to return (default: 5, max: 100)'),
    }),
    execute: async ({ projectName, limit }) => {
      console.log('[AWS] aws_get_build_status called with:', { projectName, limit });

      if (!client.hasCredentials()) {
        console.log('[AWS] No credentials configured');
        return {
          error:
            'AWS not configured. Please add your Access Key ID, Secret Access Key, and Region in Settings → Connectors.',
        };
      }

      try {
        console.log('[AWS] Getting build status for project:', projectName, 'limit:', limit);
        const builds = await client.getBuildStatus(projectName, limit);
        console.log('[AWS] Found', builds.length, 'builds');

        return {
          count: builds.length,
          projectName,
          builds: builds.map((build) => ({
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
          })),
        };
      } catch (error) {
        console.error('[AWS] Get build status error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message.includes('credentials') || message.includes('Credential')) {
          return {
            error:
              'AWS authentication failed. Please check your Access Key ID and Secret Access Key in Settings → Connectors.',
          };
        }
        if (message.includes('ResourceNotFoundException') || message.includes('does not exist')) {
          return {
            error: `CodeBuild project "${projectName}" not found. Check the project name.`,
          };
        }
        return {
          error: `Failed to get build status: ${message}`,
        };
      }
    },
  });

  const aws_describe_ecs_services = tool({
    description:
      'Get ECS service status for a cluster. Shows running tasks, desired count, deployments, and recent events. Useful for checking container service health.',
    inputSchema: z.object({
      clusterName: z
        .string()
        .describe(
          'The name or ARN of the ECS cluster (e.g., "production-cluster", "my-app-cluster", or full ARN "arn:aws:ecs:us-east-1:123456789:cluster/my-cluster")'
        ),
      serviceName: z
        .string()
        .optional()
        .describe(
          'Specific service name to describe (e.g., "web-service", "api-service"). If omitted, returns all services in the cluster.'
        ),
    }),
    execute: async ({ clusterName, serviceName }) => {
      console.log('[AWS] aws_describe_ecs_services called with:', { clusterName, serviceName });

      if (!client.hasCredentials()) {
        console.log('[AWS] No credentials configured');
        return {
          error:
            'AWS not configured. Please add your Access Key ID, Secret Access Key, and Region in Settings → Connectors.',
        };
      }

      try {
        console.log('[AWS] Describing ECS services in cluster:', clusterName, 'service:', serviceName || '(all)');
        const services = await client.describeECSServices(clusterName, serviceName);
        console.log('[AWS] Found', services.length, 'services');

        return {
          count: services.length,
          clusterName,
          services: services.map((service) => ({
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
          })),
        };
      } catch (error) {
        console.error('[AWS] Describe ECS services error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message.includes('credentials') || message.includes('Credential')) {
          return {
            error:
              'AWS authentication failed. Please check your Access Key ID and Secret Access Key in Settings → Connectors.',
          };
        }
        if (message.includes('ClusterNotFoundException')) {
          return {
            error: `ECS cluster "${clusterName}" not found. Check the cluster name or ARN.`,
          };
        }
        if (message.includes('ServiceNotFoundException')) {
          return {
            error: `ECS service "${serviceName}" not found in cluster "${clusterName}". Check the service name.`,
          };
        }
        return {
          error: `Failed to describe ECS services: ${message}`,
        };
      }
    },
  });

  const aws_get_lambda_status = tool({
    description:
      'Get details about a Lambda function including runtime, memory, timeout, and state. Shows if the function is active and its configuration.',
    inputSchema: z.object({
      functionName: z
        .string()
        .describe(
          'The name or ARN of the Lambda function (e.g., "my-function", "api-handler", or full ARN "arn:aws:lambda:us-east-1:123456789:function:my-function")'
        ),
    }),
    execute: async ({ functionName }) => {
      console.log('[AWS] aws_get_lambda_status called with:', { functionName });

      if (!client.hasCredentials()) {
        console.log('[AWS] No credentials configured');
        return {
          error:
            'AWS not configured. Please add your Access Key ID, Secret Access Key, and Region in Settings → Connectors.',
        };
      }

      try {
        console.log('[AWS] Getting Lambda function status:', functionName);
        const fn = await client.getLambdaStatus(functionName);
        console.log('[AWS] Got Lambda function:', { name: fn.FunctionName, state: fn.State });

        return {
          functionName: fn.FunctionName,
          functionArn: fn.FunctionArn,
          runtime: fn.Runtime,
          handler: fn.Handler,
          codeSize: fn.CodeSize,
          description: fn.Description || '(No description)',
          timeout: fn.Timeout,
          memorySize: fn.MemorySize,
          lastModified: fn.LastModified,
          state: fn.State,
          stateReason: fn.StateReason,
          version: fn.Version,
          environmentVariableCount: fn.Environment?.Variables
            ? Object.keys(fn.Environment.Variables).length
            : 0,
          consoleUrl: `https://${client.region}.console.aws.amazon.com/lambda/home?region=${client.region}#/functions/${fn.FunctionName}`,
        };
      } catch (error) {
        console.error('[AWS] Get Lambda status error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message.includes('credentials') || message.includes('Credential')) {
          return {
            error:
              'AWS authentication failed. Please check your Access Key ID and Secret Access Key in Settings → Connectors.',
          };
        }
        if (message.includes('ResourceNotFoundException') || message.includes('Function not found')) {
          return {
            error: `Lambda function "${functionName}" not found. Check the function name or ARN.`,
          };
        }
        return {
          error: `Failed to get Lambda status: ${message}`,
        };
      }
    },
  });

  const aws_list_lambda_functions = tool({
    description:
      'List all Lambda functions in the configured AWS region. Returns function names, runtimes, memory settings, and last modified dates. Great for discovering what serverless functions you have deployed.',
    inputSchema: z.object({}),
    execute: async () => {
      console.log('[AWS] aws_list_lambda_functions called');

      if (!client.hasCredentials()) {
        console.log('[AWS] No credentials configured');
        return {
          error:
            'AWS not configured. Please add your Access Key ID, Secret Access Key, and Region in Settings → Connectors.',
        };
      }

      try {
        console.log('[AWS] Listing Lambda functions in region:', client.region);
        const functions = await client.listLambdaFunctions();
        console.log('[AWS] Found', functions.length, 'Lambda functions');

        return {
          count: functions.length,
          region: client.region,
          functions: functions.map((fn) => ({
            functionName: fn.FunctionName,
            runtime: fn.Runtime,
            memorySize: fn.MemorySize,
            timeout: fn.Timeout,
            codeSize: fn.CodeSize,
            description: fn.Description || '(No description)',
            lastModified: fn.LastModified,
            state: fn.State,
            consoleUrl: `https://${client.region}.console.aws.amazon.com/lambda/home?region=${client.region}#/functions/${fn.FunctionName}`,
          })),
        };
      } catch (error) {
        console.error('[AWS] List Lambda functions error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message.includes('credentials') || message.includes('Credential')) {
          return {
            error:
              'AWS authentication failed. Please check your Access Key ID and Secret Access Key in Settings → Connectors.',
          };
        }
        if (message.includes('AccessDenied')) {
          return {
            error: 'Access denied to Lambda. Your IAM user may need lambda:ListFunctions permission.',
          };
        }
        return {
          error: `Failed to list Lambda functions: ${message}`,
        };
      }
    },
  });

  const aws_list_ec2_instances = tool({
    description:
      'List EC2 instances in the configured AWS region. Returns instance IDs, types, states, and tags (including Name). Great for discovering what servers you have running.',
    inputSchema: z.object({
      state: z
        .enum(['running', 'stopped', 'pending', 'stopping', 'terminated'])
        .optional()
        .describe('Filter by instance state. Omit to list all instances.'),
    }),
    execute: async ({ state }) => {
      console.log('[AWS] aws_list_ec2_instances called with:', { state });

      if (!client.hasCredentials()) {
        console.log('[AWS] No credentials configured');
        return {
          error:
            'AWS not configured. Please add your Access Key ID, Secret Access Key, and Region in Settings → Connectors.',
        };
      }

      try {
        console.log('[AWS] Listing EC2 instances in region:', client.region, 'state:', state || '(all)');
        const instances = await client.listEC2Instances(state ? { state } : undefined);
        console.log('[AWS] Found', instances.length, 'EC2 instances');

        return {
          count: instances.length,
          region: client.region,
          instances: instances.map((instance) => {
            const nameTag = instance.Tags?.find((t) => t.Key === 'Name');
            return {
              instanceId: instance.InstanceId,
              name: nameTag?.Value || '(No name)',
              instanceType: instance.InstanceType,
              state: instance.State?.Name,
              publicIp: instance.PublicIpAddress,
              privateIp: instance.PrivateIpAddress,
              launchTime: instance.LaunchTime?.toISOString(),
              platform: instance.Platform || 'linux',
              tags: instance.Tags?.filter((t) => t.Key !== 'Name').map((t) => ({
                key: t.Key,
                value: t.Value,
              })),
              consoleUrl: `https://${client.region}.console.aws.amazon.com/ec2/home?region=${client.region}#InstanceDetails:instanceId=${instance.InstanceId}`,
            };
          }),
        };
      } catch (error) {
        console.error('[AWS] List EC2 instances error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message.includes('credentials') || message.includes('Credential')) {
          return {
            error:
              'AWS authentication failed. Please check your Access Key ID and Secret Access Key in Settings → Connectors.',
          };
        }
        if (message.includes('AccessDenied') || message.includes('UnauthorizedOperation')) {
          return {
            error: 'Access denied to EC2. Your IAM user may need ec2:DescribeInstances permission.',
          };
        }
        return {
          error: `Failed to list EC2 instances: ${message}`,
        };
      }
    },
  });

  const aws_list_s3_buckets = tool({
    description:
      'List all S3 buckets in your AWS account. Returns bucket names and creation dates. Note: S3 buckets are global (not region-specific), but you need credentials for any region to list them.',
    inputSchema: z.object({}),
    execute: async () => {
      console.log('[AWS] aws_list_s3_buckets called');

      if (!client.hasCredentials()) {
        console.log('[AWS] No credentials configured');
        return {
          error:
            'AWS not configured. Please add your Access Key ID, Secret Access Key, and Region in Settings → Connectors.',
        };
      }

      try {
        console.log('[AWS] Listing S3 buckets');
        const buckets = await client.listS3Buckets();
        console.log('[AWS] Found', buckets.length, 'S3 buckets');

        return {
          count: buckets.length,
          buckets: buckets.map((bucket) => ({
            name: bucket.Name,
            creationDate: bucket.CreationDate?.toISOString(),
            consoleUrl: `https://s3.console.aws.amazon.com/s3/buckets/${bucket.Name}`,
          })),
        };
      } catch (error) {
        console.error('[AWS] List S3 buckets error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message.includes('credentials') || message.includes('Credential')) {
          return {
            error:
              'AWS authentication failed. Please check your Access Key ID and Secret Access Key in Settings → Connectors.',
          };
        }
        if (message.includes('AccessDenied')) {
          return {
            error: 'Access denied to S3. Your IAM user may need s3:ListAllMyBuckets permission.',
          };
        }
        return {
          error: `Failed to list S3 buckets: ${message}`,
        };
      }
    },
  });

  const aws_list_dynamodb_tables = tool({
    description:
      'List all DynamoDB tables in the configured AWS region. Returns table names. Use aws_describe_dynamodb_table to get details about a specific table.',
    inputSchema: z.object({}),
    execute: async () => {
      console.log('[AWS] aws_list_dynamodb_tables called');

      if (!client.hasCredentials()) {
        console.log('[AWS] No credentials configured');
        return {
          error:
            'AWS not configured. Please add your Access Key ID, Secret Access Key, and Region in Settings → Connectors.',
        };
      }

      try {
        console.log('[AWS] Listing DynamoDB tables in region:', client.region);
        const tables = await client.listDynamoDBTables();
        console.log('[AWS] Found', tables.length, 'DynamoDB tables');

        return {
          count: tables.length,
          region: client.region,
          tables: tables.map((tableName) => ({
            name: tableName,
            consoleUrl: `https://${client.region}.console.aws.amazon.com/dynamodbv2/home?region=${client.region}#table?name=${tableName}`,
          })),
        };
      } catch (error) {
        console.error('[AWS] List DynamoDB tables error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message.includes('credentials') || message.includes('Credential')) {
          return {
            error:
              'AWS authentication failed. Please check your Access Key ID and Secret Access Key in Settings → Connectors.',
          };
        }
        if (message.includes('AccessDenied')) {
          return {
            error: 'Access denied to DynamoDB. Your IAM user may need dynamodb:ListTables permission.',
          };
        }
        return {
          error: `Failed to list DynamoDB tables: ${message}`,
        };
      }
    },
  });

  const aws_describe_dynamodb_table = tool({
    description:
      'Get detailed information about a specific DynamoDB table including its schema, throughput settings, indexes, and item count. Use aws_list_dynamodb_tables first to find table names.',
    inputSchema: z.object({
      tableName: z
        .string()
        .describe('The name of the DynamoDB table (e.g., "users", "orders", "sessions"). Get this from aws_list_dynamodb_tables results.'),
    }),
    execute: async ({ tableName }) => {
      console.log('[AWS] aws_describe_dynamodb_table called with:', { tableName });

      if (!client.hasCredentials()) {
        console.log('[AWS] No credentials configured');
        return {
          error:
            'AWS not configured. Please add your Access Key ID, Secret Access Key, and Region in Settings → Connectors.',
        };
      }

      try {
        console.log('[AWS] Describing DynamoDB table:', tableName);
        const table = await client.describeDynamoDBTable(tableName);
        console.log('[AWS] Got DynamoDB table:', { name: table.TableName, status: table.TableStatus });

        return {
          tableName: table.TableName,
          tableStatus: table.TableStatus,
          creationDateTime: table.CreationDateTime?.toISOString(),
          itemCount: table.ItemCount,
          tableSizeBytes: table.TableSizeBytes,
          keySchema: table.KeySchema?.map((key) => ({
            attributeName: key.AttributeName,
            keyType: key.KeyType,
          })),
          attributeDefinitions: table.AttributeDefinitions?.map((attr) => ({
            attributeName: attr.AttributeName,
            attributeType: attr.AttributeType,
          })),
          billingMode: table.BillingModeSummary?.BillingMode || 'PROVISIONED',
          provisionedThroughput: table.ProvisionedThroughput
            ? {
                readCapacityUnits: table.ProvisionedThroughput.ReadCapacityUnits,
                writeCapacityUnits: table.ProvisionedThroughput.WriteCapacityUnits,
              }
            : undefined,
          globalSecondaryIndexes: table.GlobalSecondaryIndexes?.map((gsi) => ({
            indexName: gsi.IndexName,
            keySchema: gsi.KeySchema?.map((key) => ({
              attributeName: key.AttributeName,
              keyType: key.KeyType,
            })),
            itemCount: gsi.ItemCount,
          })),
          consoleUrl: `https://${client.region}.console.aws.amazon.com/dynamodbv2/home?region=${client.region}#table?name=${tableName}`,
        };
      } catch (error) {
        console.error('[AWS] Describe DynamoDB table error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message.includes('credentials') || message.includes('Credential')) {
          return {
            error:
              'AWS authentication failed. Please check your Access Key ID and Secret Access Key in Settings → Connectors.',
          };
        }
        if (message.includes('ResourceNotFoundException') || message.includes('not found')) {
          return {
            error: `DynamoDB table "${tableName}" not found. Use aws_list_dynamodb_tables to find available tables.`,
          };
        }
        return {
          error: `Failed to describe DynamoDB table: ${message}`,
        };
      }
    },
  });

  const aws_scan_dynamodb_table = tool({
    description:
      'Scan a DynamoDB table to retrieve items. Scans read every item in the table and can optionally filter results. Use aws_query_dynamodb_table instead when you know the partition key for better performance. Limited to 100 items by default.',
    inputSchema: z.object({
      tableName: z
        .string()
        .describe('The name of the DynamoDB table to scan'),
      filterExpression: z
        .string()
        .optional()
        .describe(
          'Optional filter expression to filter results after scanning (e.g., "contains(#name, :value)"). Note: filtering happens after reading, so it still consumes read capacity for all items.'
        ),
      expressionAttributeNames: z
        .record(z.string())
        .optional()
        .describe(
          'Substitution tokens for attribute names in expressions (e.g., {"#name": "userName"}). Required when attribute names are reserved words or contain special characters.'
        ),
      expressionAttributeValues: z
        .record(
          z.object({
            S: z.string().optional().describe('String value'),
            N: z.string().optional().describe('Number value (as string)'),
            BOOL: z.boolean().optional().describe('Boolean value'),
          })
        )
        .optional()
        .describe(
          'Substitution tokens for attribute values in expressions (e.g., {":value": {"S": "John"}}). Use S for strings, N for numbers (as strings), BOOL for booleans.'
        ),
      limit: z
        .number()
        .optional()
        .default(100)
        .describe('Maximum number of items to return (default: 100, max recommended: 1000)'),
      projectionExpression: z
        .string()
        .optional()
        .describe(
          'Comma-separated list of attributes to retrieve (e.g., "userId, userName, email"). Omit to get all attributes.'
        ),
    }),
    execute: async ({ tableName, filterExpression, expressionAttributeNames, expressionAttributeValues, limit, projectionExpression }) => {
      console.log('[AWS] aws_scan_dynamodb_table called with:', { tableName, filterExpression, limit });

      if (!client.hasCredentials()) {
        console.log('[AWS] No credentials configured');
        return {
          error:
            'AWS not configured. Please add your Access Key ID, Secret Access Key, and Region in Settings → Connectors.',
        };
      }

      try {
        console.log('[AWS] Scanning DynamoDB table:', tableName);
        const result = await client.scanDynamoDBTable(tableName, {
          filterExpression,
          expressionAttributeNames,
          expressionAttributeValues: expressionAttributeValues as Record<string, import('@aws-sdk/client-dynamodb').AttributeValue>,
          limit,
          projectionExpression,
        });
        console.log('[AWS] Scan returned', result.count, 'items (scanned', result.scannedCount, ')');

        return {
          tableName,
          count: result.count,
          scannedCount: result.scannedCount,
          items: result.items,
          note: result.count < result.scannedCount
            ? `Filter matched ${result.count} of ${result.scannedCount} scanned items`
            : undefined,
        };
      } catch (error) {
        console.error('[AWS] Scan DynamoDB table error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message.includes('credentials') || message.includes('Credential')) {
          return {
            error:
              'AWS authentication failed. Please check your Access Key ID and Secret Access Key in Settings → Connectors.',
          };
        }
        if (message.includes('ResourceNotFoundException') || message.includes('not found')) {
          return {
            error: `DynamoDB table "${tableName}" not found. Use aws_list_dynamodb_tables to find available tables.`,
          };
        }
        if (message.includes('ValidationException')) {
          return {
            error: `Invalid scan parameters: ${message}. Check your filter expression and attribute names/values.`,
          };
        }
        return {
          error: `Failed to scan DynamoDB table: ${message}`,
        };
      }
    },
  });

  const aws_query_dynamodb_table = tool({
    description:
      'Query a DynamoDB table by partition key (and optionally sort key). More efficient than scan because it only reads items matching the key condition. Use this when you know the partition key value.',
    inputSchema: z.object({
      tableName: z
        .string()
        .describe('The name of the DynamoDB table to query'),
      keyConditionExpression: z
        .string()
        .describe(
          'Key condition expression specifying partition key (required) and optional sort key conditions. Examples: "#pk = :pkValue" or "#pk = :pkValue AND #sk BETWEEN :start AND :end"'
        ),
      expressionAttributeNames: z
        .record(z.string())
        .describe(
          'Substitution tokens for attribute names (e.g., {"#pk": "userId", "#sk": "timestamp"}). Always use # prefix for names in expressions.'
        ),
      expressionAttributeValues: z
        .record(
          z.object({
            S: z.string().optional().describe('String value'),
            N: z.string().optional().describe('Number value (as string)'),
            BOOL: z.boolean().optional().describe('Boolean value'),
          })
        )
        .describe(
          'Substitution tokens for attribute values (e.g., {":pkValue": {"S": "user123"}}). Always use : prefix for values in expressions.'
        ),
      filterExpression: z
        .string()
        .optional()
        .describe(
          'Optional filter to apply after query (e.g., "#status = :active"). Does not reduce read capacity, only filters results.'
        ),
      limit: z
        .number()
        .optional()
        .default(100)
        .describe('Maximum number of items to return (default: 100)'),
      scanIndexForward: z
        .boolean()
        .optional()
        .default(true)
        .describe('Sort order for sort key: true = ascending (oldest first), false = descending (newest first)'),
      indexName: z
        .string()
        .optional()
        .describe(
          'Name of a Global Secondary Index (GSI) or Local Secondary Index (LSI) to query instead of the main table'
        ),
      projectionExpression: z
        .string()
        .optional()
        .describe(
          'Comma-separated list of attributes to retrieve (e.g., "userId, userName, email"). Omit to get all attributes.'
        ),
    }),
    execute: async ({
      tableName,
      keyConditionExpression,
      expressionAttributeNames,
      expressionAttributeValues,
      filterExpression,
      limit,
      scanIndexForward,
      indexName,
      projectionExpression,
    }) => {
      console.log('[AWS] aws_query_dynamodb_table called with:', {
        tableName,
        keyConditionExpression,
        indexName,
        limit,
      });

      if (!client.hasCredentials()) {
        console.log('[AWS] No credentials configured');
        return {
          error:
            'AWS not configured. Please add your Access Key ID, Secret Access Key, and Region in Settings → Connectors.',
        };
      }

      try {
        console.log('[AWS] Querying DynamoDB table:', tableName, indexName ? `(index: ${indexName})` : '');
        const result = await client.queryDynamoDBTable(tableName, keyConditionExpression, {
          expressionAttributeNames,
          expressionAttributeValues: expressionAttributeValues as Record<string, import('@aws-sdk/client-dynamodb').AttributeValue>,
          filterExpression,
          limit,
          scanIndexForward,
          indexName,
          projectionExpression,
        });
        console.log('[AWS] Query returned', result.count, 'items');

        return {
          tableName,
          indexName: indexName || '(main table)',
          count: result.count,
          items: result.items,
        };
      } catch (error) {
        console.error('[AWS] Query DynamoDB table error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message.includes('credentials') || message.includes('Credential')) {
          return {
            error:
              'AWS authentication failed. Please check your Access Key ID and Secret Access Key in Settings → Connectors.',
          };
        }
        if (message.includes('ResourceNotFoundException') || message.includes('not found')) {
          return {
            error: `DynamoDB table "${tableName}" not found. Use aws_list_dynamodb_tables to find available tables.`,
          };
        }
        if (message.includes('ValidationException')) {
          return {
            error: `Invalid query parameters: ${message}. Check your key condition expression and attribute names/values. Make sure you're querying by the partition key.`,
          };
        }
        return {
          error: `Failed to query DynamoDB table: ${message}`,
        };
      }
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
    aws_list_lambda_functions,
    aws_list_ec2_instances,
    aws_list_s3_buckets,
    aws_list_dynamodb_tables,
    aws_describe_dynamodb_table,
    aws_scan_dynamodb_table,
    aws_query_dynamodb_table,
  };
}
