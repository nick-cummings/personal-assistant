import { OutlookClient } from './client';
import { createOutlookTools } from './tools';
import type { Connector, ConnectionTestResult, ToolSet, OutlookConfig } from '../types';

export class OutlookConnector implements Connector<'outlook'> {
  type = 'outlook' as const;
  name = 'Outlook';

  private client: OutlookClient;

  constructor(config: OutlookConfig) {
    this.client = new OutlookClient(config);
  }

  getTools(): ToolSet {
    return createOutlookTools(this.client);
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      // Check if OAuth is set up
      if (!this.client.hasRefreshToken()) {
        return {
          success: false,
          error: 'OAuth not completed. Please visit /api/auth/outlook to authorize.',
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

export { OutlookClient, getOutlookAuthUrl, exchangeOutlookCode } from './client';
export { createOutlookTools } from './tools';
