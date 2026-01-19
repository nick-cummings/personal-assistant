import { GoogleSheetsClient } from './client';
import { createGoogleSheetsTools } from './tools';
import type { Connector, ConnectionTestResult, ToolSet, GoogleSheetsConfig } from '../types';

export class GoogleSheetsConnector implements Connector<'google-sheets'> {
  type = 'google-sheets' as const;
  name = 'Google Sheets';

  private client: GoogleSheetsClient;

  constructor(config: GoogleSheetsConfig) {
    this.client = new GoogleSheetsClient(config);
  }

  getTools(): ToolSet {
    return createGoogleSheetsTools(this.client);
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      if (!this.client.hasRefreshToken()) {
        return {
          success: false,
          error: 'OAuth not completed. Please visit /api/auth/google-sheets to authorize.',
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

export { GoogleSheetsClient, getGoogleSheetsAuthUrl, exchangeGoogleSheetsCode } from './client';
export { createGoogleSheetsTools } from './tools';
