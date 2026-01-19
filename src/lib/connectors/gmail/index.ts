import { GmailClient } from './client';
import { createGmailTools } from './tools';
import type { Connector, ConnectionTestResult, ToolSet, GmailConfig } from '../types';

export class GmailConnector implements Connector<'gmail'> {
  type = 'gmail' as const;
  name = 'Gmail';

  private client: GmailClient;

  constructor(config: GmailConfig) {
    this.client = new GmailClient(config);
  }

  getTools(): ToolSet {
    return createGmailTools(this.client);
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      // Check if OAuth is set up
      if (!this.client.hasRefreshToken()) {
        return {
          success: false,
          error: 'OAuth not completed. Please visit /api/auth/gmail to authorize.',
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

export { GmailClient, getGmailAuthUrl, exchangeGmailCode } from './client';
export { createGmailTools } from './tools';
