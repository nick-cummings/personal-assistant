import type { AWSConfig, ConnectionTestResult, Connector, ToolSet } from '../types';
import { AWSClient } from './client';
import { createAWSTools } from './tools';

export class AWSConnector implements Connector<'aws'> {
  type = 'aws' as const;
  name = 'AWS';

  private client: AWSClient;

  constructor(config: AWSConfig) {
    this.client = new AWSClient(config);
  }

  getTools(): ToolSet {
    return createAWSTools(this.client);
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      await this.client.testConnection();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

export { AWSClient } from './client';
export { createAWSTools } from './tools';
