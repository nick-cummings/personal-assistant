import {
    CloudWatchLogsClient,
    DescribeLogGroupsCommand,
    FilterLogEventsCommand, type FilteredLogEvent, type LogGroup
} from '@aws-sdk/client-cloudwatch-logs';
import {
    BatchGetBuildsCommand, CodeBuildClient,
    ListBuildsForProjectCommand, type Build
} from '@aws-sdk/client-codebuild';
import {
    CodePipelineClient, GetPipelineStateCommand, ListPipelinesCommand, type PipelineSummary,
    type StageState
} from '@aws-sdk/client-codepipeline';
import {
    DescribeTableCommand, DynamoDBClient,
    ListTablesCommand, QueryCommand, ScanCommand, type AttributeValue, type TableDescription
} from '@aws-sdk/client-dynamodb';
import {
    DescribeInstancesCommand, EC2Client, type Instance
} from '@aws-sdk/client-ec2';
import {
    DescribeServicesCommand, ECSClient,
    ListServicesCommand, type Service
} from '@aws-sdk/client-ecs';
import {
    GetFunctionCommand, LambdaClient, ListFunctionsCommand,
    type FunctionConfiguration
} from '@aws-sdk/client-lambda';
import { ListBucketsCommand, S3Client, type Bucket } from '@aws-sdk/client-s3';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import type { AWSConfig } from '../types';

export class AWSClient {
  private config: AWSConfig;
  private cloudWatchLogs: CloudWatchLogsClient;
  private codePipeline: CodePipelineClient;
  private codeBuild: CodeBuildClient;
  private ecs: ECSClient;
  private lambda: LambdaClient;
  private ec2: EC2Client;
  private s3: S3Client;
  private dynamodb: DynamoDBClient;
  public region: string;

  constructor(config: AWSConfig) {
    this.config = config;
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

    this.ec2 = new EC2Client({
      region: config.region,
      credentials,
    });

    this.s3 = new S3Client({
      region: config.region,
      credentials,
    });

    this.dynamodb = new DynamoDBClient({
      region: config.region,
      credentials,
    });
  }

  hasCredentials(): boolean {
    return !!(this.config.accessKeyId && this.config.secretAccessKey && this.config.region);
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
  async getBuildStatus(projectName: string, limit: number = 5): Promise<Build[]> {
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
  async describeECSServices(clusterName: string, serviceName?: string): Promise<Service[]> {
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

  // List Lambda functions
  async listLambdaFunctions(): Promise<FunctionConfiguration[]> {
    const functions: FunctionConfiguration[] = [];
    let marker: string | undefined;

    do {
      const command = new ListFunctionsCommand({
        Marker: marker,
        MaxItems: 50,
      });
      const response = await this.lambda.send(command);
      functions.push(...(response.Functions ?? []));
      marker = response.NextMarker;
    } while (marker);

    return functions;
  }

  // EC2 Instances
  async listEC2Instances(filters?: { state?: string }): Promise<Instance[]> {
    const command = new DescribeInstancesCommand({
      Filters: filters?.state
        ? [{ Name: 'instance-state-name', Values: [filters.state] }]
        : undefined,
      MaxResults: 100,
    });
    const response = await this.ec2.send(command);
    const instances: Instance[] = [];
    for (const reservation of response.Reservations ?? []) {
      instances.push(...(reservation.Instances ?? []));
    }
    return instances;
  }

  // S3 Buckets
  async listS3Buckets(): Promise<Bucket[]> {
    const command = new ListBucketsCommand({});
    const response = await this.s3.send(command);
    return response.Buckets ?? [];
  }

  // DynamoDB Tables
  async listDynamoDBTables(): Promise<string[]> {
    const tables: string[] = [];
    let lastEvaluatedTableName: string | undefined;

    do {
      const command = new ListTablesCommand({
        ExclusiveStartTableName: lastEvaluatedTableName,
        Limit: 100,
      });
      const response = await this.dynamodb.send(command);
      tables.push(...(response.TableNames ?? []));
      lastEvaluatedTableName = response.LastEvaluatedTableName;
    } while (lastEvaluatedTableName);

    return tables;
  }

  async describeDynamoDBTable(tableName: string): Promise<TableDescription> {
    const command = new DescribeTableCommand({ TableName: tableName });
    const response = await this.dynamodb.send(command);
    if (!response.Table) {
      throw new Error(`DynamoDB table ${tableName} not found`);
    }
    return response.Table;
  }

  // Scan DynamoDB table (returns all items, use with caution on large tables)
  async scanDynamoDBTable(
    tableName: string,
    options?: {
      filterExpression?: string;
      expressionAttributeNames?: Record<string, string>;
      expressionAttributeValues?: Record<string, AttributeValue>;
      limit?: number;
      projectionExpression?: string;
    }
  ): Promise<{ items: Record<string, unknown>[]; count: number; scannedCount: number }> {
    const command = new ScanCommand({
      TableName: tableName,
      FilterExpression: options?.filterExpression,
      ExpressionAttributeNames: options?.expressionAttributeNames,
      ExpressionAttributeValues: options?.expressionAttributeValues,
      Limit: options?.limit ?? 100,
      ProjectionExpression: options?.projectionExpression,
    });
    const response = await this.dynamodb.send(command);
    const items = (response.Items ?? []).map((item) => unmarshall(item));
    return {
      items,
      count: response.Count ?? 0,
      scannedCount: response.ScannedCount ?? 0,
    };
  }

  // Query DynamoDB table by partition key (and optionally sort key)
  async queryDynamoDBTable(
    tableName: string,
    keyConditionExpression: string,
    options?: {
      expressionAttributeNames?: Record<string, string>;
      expressionAttributeValues?: Record<string, AttributeValue>;
      filterExpression?: string;
      limit?: number;
      scanIndexForward?: boolean; // true = ascending, false = descending
      indexName?: string;
      projectionExpression?: string;
    }
  ): Promise<{ items: Record<string, unknown>[]; count: number }> {
    const command = new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: keyConditionExpression,
      ExpressionAttributeNames: options?.expressionAttributeNames,
      ExpressionAttributeValues: options?.expressionAttributeValues,
      FilterExpression: options?.filterExpression,
      Limit: options?.limit ?? 100,
      ScanIndexForward: options?.scanIndexForward,
      IndexName: options?.indexName,
      ProjectionExpression: options?.projectionExpression,
    });
    const response = await this.dynamodb.send(command);
    const items = (response.Items ?? []).map((item) => unmarshall(item));
    return {
      items,
      count: response.Count ?? 0,
    };
  }

  // Test connection by trying to list pipelines (simple operation)
  async testConnection(): Promise<void> {
    await this.listPipelines();
  }
}
