import {
  CloudWatchLogsClient,
  DescribeLogGroupsCommand,
  FilterLogEventsCommand,
  type LogGroup,
  type FilteredLogEvent,
} from '@aws-sdk/client-cloudwatch-logs';
import {
  CodePipelineClient,
  ListPipelinesCommand,
  GetPipelineStateCommand,
  type PipelineSummary,
  type StageState,
} from '@aws-sdk/client-codepipeline';
import {
  CodeBuildClient,
  ListBuildsForProjectCommand,
  BatchGetBuildsCommand,
  type Build,
} from '@aws-sdk/client-codebuild';
import {
  ECSClient,
  ListServicesCommand,
  DescribeServicesCommand,
  type Service,
} from '@aws-sdk/client-ecs';
import {
  LambdaClient,
  GetFunctionCommand,
  type FunctionConfiguration,
} from '@aws-sdk/client-lambda';
import type { AWSConfig } from '../types';

export class AWSClient {
  private cloudWatchLogs: CloudWatchLogsClient;
  private codePipeline: CodePipelineClient;
  private codeBuild: CodeBuildClient;
  private ecs: ECSClient;
  private lambda: LambdaClient;
  public region: string;

  constructor(config: AWSConfig) {
    const credentials = {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    };

    this.region = config.region;

    this.cloudWatchLogs = new CloudWatchLogsClient({
      region: config.region,
      credentials,
    });

    this.codePipeline = new CodePipelineClient({
      region: config.region,
      credentials,
    });

    this.codeBuild = new CodeBuildClient({
      region: config.region,
      credentials,
    });

    this.ecs = new ECSClient({
      region: config.region,
      credentials,
    });

    this.lambda = new LambdaClient({
      region: config.region,
      credentials,
    });
  }

  // CloudWatch Logs
  async listLogGroups(prefix?: string): Promise<LogGroup[]> {
    const command = new DescribeLogGroupsCommand({
      logGroupNamePrefix: prefix,
      limit: 50,
    });
    const response = await this.cloudWatchLogs.send(command);
    return response.logGroups ?? [];
  }

  async searchLogs(
    logGroupName: string,
    filterPattern: string,
    options?: {
      startTime?: number;
      endTime?: number;
      limit?: number;
    }
  ): Promise<FilteredLogEvent[]> {
    const command = new FilterLogEventsCommand({
      logGroupName,
      filterPattern,
      startTime: options?.startTime,
      endTime: options?.endTime,
      limit: options?.limit ?? 100,
    });
    const response = await this.cloudWatchLogs.send(command);
    return response.events ?? [];
  }

  // CodePipeline
  async listPipelines(): Promise<PipelineSummary[]> {
    const command = new ListPipelinesCommand({});
    const response = await this.codePipeline.send(command);
    return response.pipelines ?? [];
  }

  async getPipelineStatus(
    pipelineName: string
  ): Promise<{ pipelineName: string; stages: StageState[] }> {
    const command = new GetPipelineStateCommand({ name: pipelineName });
    const response = await this.codePipeline.send(command);
    return {
      pipelineName: response.pipelineName ?? pipelineName,
      stages: response.stageStates ?? [],
    };
  }

  // CodeBuild
  async getBuildStatus(
    projectName: string,
    limit: number = 5
  ): Promise<Build[]> {
    // First get build IDs
    const listCommand = new ListBuildsForProjectCommand({
      projectName,
      sortOrder: 'DESCENDING',
    });
    const listResponse = await this.codeBuild.send(listCommand);
    const buildIds = (listResponse.ids ?? []).slice(0, limit);

    if (buildIds.length === 0) {
      return [];
    }

    // Then get build details
    const batchCommand = new BatchGetBuildsCommand({ ids: buildIds });
    const batchResponse = await this.codeBuild.send(batchCommand);
    return batchResponse.builds ?? [];
  }

  // ECS
  async describeECSServices(
    clusterName: string,
    serviceName?: string
  ): Promise<Service[]> {
    if (serviceName) {
      // Get specific service
      const command = new DescribeServicesCommand({
        cluster: clusterName,
        services: [serviceName],
      });
      const response = await this.ecs.send(command);
      return response.services ?? [];
    }

    // List all services in cluster
    const listCommand = new ListServicesCommand({
      cluster: clusterName,
      maxResults: 50,
    });
    const listResponse = await this.ecs.send(listCommand);
    const serviceArns = listResponse.serviceArns ?? [];

    if (serviceArns.length === 0) {
      return [];
    }

    // Get service details (max 10 at a time)
    const services: Service[] = [];
    for (let i = 0; i < serviceArns.length; i += 10) {
      const batch = serviceArns.slice(i, i + 10);
      const describeCommand = new DescribeServicesCommand({
        cluster: clusterName,
        services: batch,
      });
      const describeResponse = await this.ecs.send(describeCommand);
      services.push(...(describeResponse.services ?? []));
    }

    return services;
  }

  // Lambda
  async getLambdaStatus(functionName: string): Promise<FunctionConfiguration> {
    const command = new GetFunctionCommand({ FunctionName: functionName });
    const response = await this.lambda.send(command);
    if (!response.Configuration) {
      throw new Error(`Lambda function ${functionName} not found`);
    }
    return response.Configuration;
  }

  // Test connection by trying to list pipelines (simple operation)
  async testConnection(): Promise<void> {
    await this.listPipelines();
  }
}
