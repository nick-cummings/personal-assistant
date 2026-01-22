/**
 * Manual test script for AWS connector
 *
 * Usage:
 *   bun run src/lib/connectors/aws/test-aws.ts
 *
 * Make sure to set environment variables in .env:
 *   AWS_ACCESS_KEY_ID=your-access-key-id
 *   AWS_SECRET_ACCESS_KEY=your-secret-access-key
 *   AWS_REGION=us-east-1 (or your preferred region)
 */

import { AWSClient } from './client';

const config = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1',
};

async function main() {
  console.log('=== AWS Connector Test ===\n');

  if (!config.accessKeyId || !config.secretAccessKey) {
    console.error('Error: Missing credentials');
    console.error('Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables');
    console.error('Example:');
    console.error(
      '  AWS_ACCESS_KEY_ID=AKIA... AWS_SECRET_ACCESS_KEY=... AWS_REGION=us-east-1 bun run src/lib/connectors/aws/test-aws.ts'
    );
    process.exit(1);
  }

  console.log('Access Key ID:', config.accessKeyId.substring(0, 8) + '...');
  console.log('Region:', config.region);
  console.log();

  const client = new AWSClient(config);

  // Test 1: Check credentials method
  console.log('--- Test 1: hasCredentials() ---');
  console.log('Has credentials:', client.hasCredentials());
  console.log();

  // Test 2: Test connection (list pipelines as a simple test)
  console.log('--- Test 2: testConnection() ---');
  try {
    await client.testConnection();
    console.log('Connection successful!');
    console.log();
  } catch (error) {
    console.error('Connection failed:', error);
    console.log(
      'Note: This might fail if you have no CodePipeline access, continuing with other tests...\n'
    );
  }

  // Test 3: List log groups
  console.log('--- Test 3: listLogGroups() ---');
  let firstLogGroup: string | null = null;
  try {
    const logGroups = await client.listLogGroups();
    console.log('Found', logGroups.length, 'log groups:');
    for (const lg of logGroups.slice(0, 5)) {
      console.log(`  - ${lg.logGroupName}`);
      console.log(
        `    Stored: ${lg.storedBytes || 0} bytes, Retention: ${lg.retentionInDays || 'Never expire'} days`
      );
      if (!firstLogGroup) {
        firstLogGroup = lg.logGroupName!;
      }
    }
    if (logGroups.length > 5) {
      console.log(`  ... and ${logGroups.length - 5} more`);
    }
    console.log();
  } catch (error) {
    console.error('List log groups failed:', error);
  }

  // Test 4: Search logs (if we have a log group)
  if (firstLogGroup) {
    console.log(`--- Test 4: searchLogs("${firstLogGroup}", "ERROR", last hour) ---`);
    try {
      const now = Date.now();
      const events = await client.searchLogs(firstLogGroup, 'ERROR', {
        startTime: now - 3600000, // 1 hour ago
        endTime: now,
        limit: 5,
      });
      console.log('Found', events.length, 'log events:');
      for (const event of events) {
        const timestamp = event.timestamp ? new Date(event.timestamp).toISOString() : 'unknown';
        const message = event.message?.substring(0, 100) || '';
        console.log(`  - [${timestamp}] ${message}${message.length >= 100 ? '...' : ''}`);
      }
      console.log();
    } catch (error) {
      console.error('Search logs failed:', error);
    }
  } else {
    console.log('--- Test 4: Skipped (no log groups found) ---\n');
  }

  // Test 5: List pipelines
  console.log('--- Test 5: listPipelines() ---');
  let firstPipeline: string | null = null;
  try {
    const pipelines = await client.listPipelines();
    console.log('Found', pipelines.length, 'pipelines:');
    for (const p of pipelines.slice(0, 5)) {
      console.log(`  - ${p.name} (v${p.version})`);
      console.log(`    Created: ${p.created?.toISOString() || 'N/A'}`);
      if (!firstPipeline) {
        firstPipeline = p.name!;
      }
    }
    if (pipelines.length > 5) {
      console.log(`  ... and ${pipelines.length - 5} more`);
    }
    console.log();
  } catch (error) {
    console.error('List pipelines failed:', error);
  }

  // Test 6: Get pipeline status
  if (firstPipeline) {
    console.log(`--- Test 6: getPipelineStatus("${firstPipeline}") ---`);
    try {
      const status = await client.getPipelineStatus(firstPipeline);
      console.log('Pipeline:', status.pipelineName);
      console.log('Stages:', status.stages.length);
      for (const stage of status.stages) {
        console.log(`  - ${stage.stageName}: ${stage.latestExecution?.status || 'N/A'}`);
        for (const action of stage.actionStates || []) {
          console.log(`    - ${action.actionName}: ${action.latestExecution?.status || 'N/A'}`);
        }
      }
      console.log();
    } catch (error) {
      console.error('Get pipeline status failed:', error);
    }
  } else {
    console.log('--- Test 6: Skipped (no pipelines found) ---\n');
  }

  // Test 7: List Lambda log groups (specific prefix)
  console.log('--- Test 7: listLogGroups("/aws/lambda") ---');
  let lambdaLogGroup: string | null = null;
  try {
    const logGroups = await client.listLogGroups('/aws/lambda');
    console.log('Found', logGroups.length, 'Lambda log groups:');
    for (const lg of logGroups.slice(0, 5)) {
      console.log(`  - ${lg.logGroupName}`);
      if (!lambdaLogGroup) {
        lambdaLogGroup = lg.logGroupName!;
      }
    }
    if (logGroups.length > 5) {
      console.log(`  ... and ${logGroups.length - 5} more`);
    }
    console.log();
  } catch (error) {
    console.error('List Lambda log groups failed:', error);
  }

  // Test 8: Get Lambda status (extract function name from log group)
  if (lambdaLogGroup) {
    // Extract function name from log group like "/aws/lambda/my-function"
    const functionName = lambdaLogGroup.replace('/aws/lambda/', '');
    console.log(`--- Test 8: getLambdaStatus("${functionName}") ---`);
    try {
      const fn = await client.getLambdaStatus(functionName);
      console.log('Lambda function:');
      console.log('  Name:', fn.FunctionName);
      console.log('  Runtime:', fn.Runtime);
      console.log('  Memory:', fn.MemorySize, 'MB');
      console.log('  Timeout:', fn.Timeout, 'seconds');
      console.log('  State:', fn.State);
      console.log('  Last modified:', fn.LastModified);
      console.log();
    } catch (error) {
      console.error('Get Lambda status failed:', error);
    }
  } else {
    console.log('--- Test 8: Skipped (no Lambda log groups found) ---\n');
  }

  // Test 9: Search for any recent logs
  if (firstLogGroup) {
    console.log(`--- Test 9: searchLogs("${firstLogGroup}", "", last 10 min, limit 3) ---`);
    try {
      const now = Date.now();
      const events = await client.searchLogs(firstLogGroup, '', {
        startTime: now - 600000, // 10 minutes ago
        endTime: now,
        limit: 3,
      });
      console.log('Found', events.length, 'recent log events:');
      for (const event of events) {
        const timestamp = event.timestamp ? new Date(event.timestamp).toISOString() : 'unknown';
        console.log(`  - [${timestamp}]`);
        console.log(`    ${event.message?.substring(0, 80) || ''}...`);
      }
      console.log();
    } catch (error) {
      console.error('Search recent logs failed:', error);
    }
  } else {
    console.log('--- Test 9: Skipped (no log groups found) ---\n');
  }

  // Test 10: List Lambda functions (new discovery tool)
  console.log('--- Test 10: listLambdaFunctions() ---');
  try {
    const functions = await client.listLambdaFunctions();
    console.log('Found', functions.length, 'Lambda functions:');
    for (const fn of functions.slice(0, 5)) {
      console.log(`  - ${fn.FunctionName} (${fn.Runtime}, ${fn.MemorySize}MB)`);
    }
    if (functions.length > 5) {
      console.log(`  ... and ${functions.length - 5} more`);
    }
    console.log();
  } catch (error) {
    console.error('List Lambda functions failed:', error);
  }

  // Test 11: List EC2 instances
  console.log('--- Test 11: listEC2Instances() ---');
  try {
    const instances = await client.listEC2Instances();
    console.log('Found', instances.length, 'EC2 instances:');
    for (const instance of instances.slice(0, 5)) {
      const nameTag = instance.Tags?.find((t) => t.Key === 'Name');
      console.log(`  - ${instance.InstanceId}: ${nameTag?.Value || '(no name)'}`);
      console.log(`    Type: ${instance.InstanceType}, State: ${instance.State?.Name}`);
    }
    if (instances.length > 5) {
      console.log(`  ... and ${instances.length - 5} more`);
    }
    console.log();
  } catch (error) {
    console.error('List EC2 instances failed:', error);
  }

  // Test 12: List S3 buckets
  console.log('--- Test 12: listS3Buckets() ---');
  try {
    const buckets = await client.listS3Buckets();
    console.log('Found', buckets.length, 'S3 buckets:');
    for (const bucket of buckets.slice(0, 5)) {
      console.log(`  - ${bucket.Name} (created: ${bucket.CreationDate?.toISOString() || 'N/A'})`);
    }
    if (buckets.length > 5) {
      console.log(`  ... and ${buckets.length - 5} more`);
    }
    console.log();
  } catch (error) {
    console.error('List S3 buckets failed:', error);
  }

  // Test 13: List DynamoDB tables
  console.log('--- Test 13: listDynamoDBTables() ---');
  let firstTable: string | null = null;
  try {
    const tables = await client.listDynamoDBTables();
    console.log('Found', tables.length, 'DynamoDB tables:');
    for (const table of tables.slice(0, 5)) {
      console.log(`  - ${table}`);
      if (!firstTable) {
        firstTable = table;
      }
    }
    if (tables.length > 5) {
      console.log(`  ... and ${tables.length - 5} more`);
    }
    console.log();
  } catch (error) {
    console.error('List DynamoDB tables failed:', error);
  }

  // Test 14: Describe DynamoDB table
  let partitionKeyName: string | null = null;
  if (firstTable) {
    console.log(`--- Test 14: describeDynamoDBTable("${firstTable}") ---`);
    try {
      const table = await client.describeDynamoDBTable(firstTable);
      console.log('DynamoDB table:');
      console.log('  Name:', table.TableName);
      console.log('  Status:', table.TableStatus);
      console.log('  Item count:', table.ItemCount);
      console.log('  Size:', table.TableSizeBytes, 'bytes');
      console.log(
        '  Key schema:',
        table.KeySchema?.map((k) => `${k.AttributeName} (${k.KeyType})`).join(', ')
      );
      // Store partition key name for query test
      partitionKeyName = table.KeySchema?.find((k) => k.KeyType === 'HASH')?.AttributeName || null;
      console.log();
    } catch (error) {
      console.error('Describe DynamoDB table failed:', error);
    }
  } else {
    console.log('--- Test 14: Skipped (no DynamoDB tables found) ---\n');
  }

  // Test 15: Scan DynamoDB table
  if (firstTable) {
    console.log(`--- Test 15: scanDynamoDBTable("${firstTable}", limit: 5) ---`);
    try {
      const result = await client.scanDynamoDBTable(firstTable, { limit: 5 });
      console.log('Scan result:');
      console.log('  Items returned:', result.count);
      console.log('  Items scanned:', result.scannedCount);
      for (const item of result.items) {
        console.log(
          '  -',
          JSON.stringify(item).substring(0, 100) + (JSON.stringify(item).length > 100 ? '...' : '')
        );
      }
      console.log();
    } catch (error) {
      console.error('Scan DynamoDB table failed:', error);
    }
  } else {
    console.log('--- Test 15: Skipped (no DynamoDB tables found) ---\n');
  }

  // Test 16: Query DynamoDB table (if we have a partition key and items)
  if (firstTable && partitionKeyName) {
    console.log(
      `--- Test 16: Attempting query on "${firstTable}" by partition key "${partitionKeyName}" ---`
    );
    // First scan to get a sample partition key value
    try {
      const scanResult = await client.scanDynamoDBTable(firstTable, { limit: 1 });
      if (scanResult.items.length > 0) {
        const sampleItem = scanResult.items[0];
        const pkValue = sampleItem[partitionKeyName];
        if (pkValue !== undefined) {
          console.log(`  Using sample partition key value: ${JSON.stringify(pkValue)}`);
          // Determine type and construct query
          const isNumber = typeof pkValue === 'number';
          const expressionAttributeValues = isNumber
            ? { ':pk': { N: String(pkValue) } }
            : { ':pk': { S: String(pkValue) } };

          const result = await client.queryDynamoDBTable(firstTable, '#pk = :pk', {
            expressionAttributeNames: { '#pk': partitionKeyName },
            expressionAttributeValues: expressionAttributeValues as Record<
              string,
              import('@aws-sdk/client-dynamodb').AttributeValue
            >,
            limit: 5,
          });
          console.log('Query result:');
          console.log('  Items returned:', result.count);
          for (const item of result.items) {
            console.log(
              '  -',
              JSON.stringify(item).substring(0, 100) +
                (JSON.stringify(item).length > 100 ? '...' : '')
            );
          }
        } else {
          console.log('  Could not extract partition key value from sample item');
        }
      } else {
        console.log('  Table is empty, skipping query test');
      }
      console.log();
    } catch (error) {
      console.error('Query DynamoDB table failed:', error);
    }
  } else if (firstTable) {
    console.log('--- Test 16: Skipped (could not determine partition key) ---\n');
  } else {
    console.log('--- Test 16: Skipped (no DynamoDB tables found) ---\n');
  }

  console.log('=== All tests complete ===');
}

main().catch(console.error);
