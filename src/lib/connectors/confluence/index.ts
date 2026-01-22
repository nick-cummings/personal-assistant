import type { ConfluenceConfig, ConnectionTestResult, Connector, ToolSet } from '../types';
import { ConfluenceClient } from './client';
import { createConfluenceTools } from './tools';

export class ConfluenceConnector implements Connector<'confluence'> {
  type = 'confluence' as const;
  name = 'Confluence';

  private client: ConfluenceClient;

  constructor(config: ConfluenceConfig) {
    this.client = new ConfluenceClient(config);
  }

  getTools(): ToolSet {
    return createConfluenceTools(this.client);
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

export { ConfluenceClient } from './client';
export { createConfluenceTools } from './tools';
