import { JenkinsClient } from './client';
import { createJenkinsTools } from './tools';
import type { Connector, ConnectionTestResult, ToolSet, JenkinsConfig } from '../types';

export class JenkinsConnector implements Connector<'jenkins'> {
  type = 'jenkins' as const;
  name = 'Jenkins';

  private client: JenkinsClient;

  constructor(config: JenkinsConfig) {
    this.client = new JenkinsClient(config);
  }

  getTools(): ToolSet {
    return createJenkinsTools(this.client);
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

export { JenkinsClient } from './client';
export { createJenkinsTools } from './tools';
