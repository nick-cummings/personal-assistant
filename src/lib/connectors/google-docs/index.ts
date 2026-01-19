import { GoogleDocsClient } from './client';
import { createGoogleDocsTools } from './tools';
import type { Connector, ConnectionTestResult, ToolSet, GoogleDocsConfig } from '../types';

export class GoogleDocsConnector implements Connector<'google-docs'> {
  type = 'google-docs' as const;
  name = 'Google Docs';

  private client: GoogleDocsClient;

  constructor(config: GoogleDocsConfig) {
    this.client = new GoogleDocsClient(config);
  }

  getTools(): ToolSet {
    return createGoogleDocsTools(this.client);
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      if (!this.client.hasRefreshToken()) {
        return {
          success: false,
          error: 'OAuth not completed. Please visit /api/auth/google-docs to authorize.',
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

export { GoogleDocsClient, getGoogleDocsAuthUrl, exchangeGoogleDocsCode } from './client';
export { createGoogleDocsTools } from './tools';
