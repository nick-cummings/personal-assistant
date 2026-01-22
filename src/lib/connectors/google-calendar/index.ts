import type { ConnectionTestResult, Connector, GoogleCalendarConfig, ToolSet } from '../types';
import { GoogleCalendarClient } from './client';
import { createGoogleCalendarTools } from './tools';

export class GoogleCalendarConnector implements Connector<'google-calendar'> {
  type = 'google-calendar' as const;
  name = 'Google Calendar';

  private client: GoogleCalendarClient;

  constructor(config: GoogleCalendarConfig) {
    this.client = new GoogleCalendarClient(config);
  }

  getTools(): ToolSet {
    return createGoogleCalendarTools(this.client);
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      if (!this.client.hasRefreshToken()) {
        return {
          success: false,
          error: 'OAuth not completed. Please visit /api/auth/google-calendar to authorize.',
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

export {
    exchangeGoogleCalendarCode, getGoogleCalendarAuthUrl, GoogleCalendarClient
} from './client';
export { createGoogleCalendarTools } from './tools';
