import { GoogleCalendarClient } from './client';
import { createGoogleCalendarTools } from './tools';
import type { Connector, ConnectionTestResult, ToolSet, GoogleCalendarConfig } from '../types';

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

export { GoogleCalendarClient, getGoogleCalendarAuthUrl, exchangeGoogleCalendarCode } from './client';
export { createGoogleCalendarTools } from './tools';
