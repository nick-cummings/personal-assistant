import type { ConnectionTestResult, Connector, GoogleDriveConfig, ToolSet } from '../types';
import { GoogleDriveClient } from './client';
import { createGoogleDriveTools } from './tools';

export class GoogleDriveConnector implements Connector<'google-drive'> {
  type = 'google-drive' as const;
  name = 'Google Drive';

  private client: GoogleDriveClient;

  constructor(config: GoogleDriveConfig) {
    this.client = new GoogleDriveClient(config);
  }

  getTools(): ToolSet {
    return createGoogleDriveTools(this.client);
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      if (!this.client.hasRefreshToken()) {
        return {
          success: false,
          error: 'OAuth not completed. Please visit /api/auth/google-drive to authorize.',
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

export { exchangeGoogleDriveCode, getGoogleDriveAuthUrl, GoogleDriveClient } from './client';
export { createGoogleDriveTools } from './tools';
