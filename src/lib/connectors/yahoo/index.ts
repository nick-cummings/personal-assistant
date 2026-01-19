import { YahooClient } from './client';
import { createYahooTools } from './tools';
import type { Connector, ConnectionTestResult, ToolSet, YahooConfig } from '../types';

export class YahooConnector implements Connector<'yahoo'> {
  type = 'yahoo' as const;
  name = 'Yahoo Mail';

  private client: YahooClient;

  constructor(config: YahooConfig) {
    this.client = new YahooClient(config);
  }

  getTools(): ToolSet {
    return createYahooTools(this.client);
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      // Check if OAuth is set up
      if (!this.client.hasRefreshToken()) {
        return {
          success: false,
          error: 'OAuth not completed. Please visit /api/auth/yahoo to authorize.',
        };
      }

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

export { YahooClient, getYahooAuthUrl, exchangeYahooCode } from './client';
export { createYahooTools } from './tools';
