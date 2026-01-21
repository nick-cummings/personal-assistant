import { YahooImapClient, type YahooImapConfig } from './client';
import { createYahooTools } from './tools';
import type { Connector, ConnectionTestResult, ToolSet } from '../types';

export class YahooConnector implements Connector<'yahoo'> {
  type = 'yahoo' as const;
  name = 'Yahoo Mail';

  private client: YahooImapClient;

  constructor(config: YahooImapConfig) {
    this.client = new YahooImapClient(config);
  }

  getTools(): ToolSet {
    return createYahooTools(this.client);
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      await this.client.testConnection();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to connect to Yahoo Mail',
      };
    }
  }
}

export { YahooImapClient, type YahooImapConfig } from './client';
export { createYahooTools } from './tools';
