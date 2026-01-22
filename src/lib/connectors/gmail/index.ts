import type { ConnectionTestResult, Connector, ToolSet } from '../types';
import { GmailImapClient, type GmailImapConfig } from './client';
import { createGmailTools } from './tools';

export class GmailConnector implements Connector<'gmail'> {
  type = 'gmail' as const;
  name = 'Gmail';

  private client: GmailImapClient;

  constructor(config: GmailImapConfig) {
    this.client = new GmailImapClient(config);
  }

  getTools(): ToolSet {
    return createGmailTools(this.client);
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      if (!this.client.hasCredentials()) {
        return {
          success: false,
          error: 'Gmail not configured. Please add your email and app password.',
        };
      }

      await this.client.testConnection();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to connect to Gmail',
      };
    }
  }
}

export { GmailImapClient, type GmailImapConfig } from './client';
export { createGmailTools } from './tools';
