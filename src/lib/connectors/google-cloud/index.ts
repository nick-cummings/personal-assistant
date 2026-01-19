import { GoogleCloudClient } from './client';
import { createGoogleCloudTools } from './tools';
import type { Connector, ConnectionTestResult, ToolSet, GoogleCloudConfig } from '../types';

export class GoogleCloudConnector implements Connector<'google-cloud'> {
  type = 'google-cloud' as const;
  name = 'Google Cloud';

  private client: GoogleCloudClient;

  constructor(config: GoogleCloudConfig) {
    this.client = new GoogleCloudClient(config);
  }

  getTools(): ToolSet {
    return createGoogleCloudTools(this.client);
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

export { GoogleCloudClient } from './client';
export { createGoogleCloudTools } from './tools';
