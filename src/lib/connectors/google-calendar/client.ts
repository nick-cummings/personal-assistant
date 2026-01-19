import {
  OAuthClient,
  buildOAuthAuthUrl,
  exchangeOAuthCode,
  type OAuthConfig,
  type OAuthProviderConfig,
  type TokenResponse,
} from '../shared/oauth-client';

interface Calendar {
  id: string;
  summary: string;
  description?: string;
  timeZone?: string;
  primary?: boolean;
  backgroundColor?: string;
}

interface CalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  status?: string;
  htmlLink?: string;
  creator?: {
    email: string;
    displayName?: string;
  };
  organizer?: {
    email: string;
    displayName?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: string;
  }>;
  conferenceData?: {
    conferenceId?: string;
    entryPoints?: Array<{
      entryPointType: string;
      uri: string;
    }>;
  };
  recurringEventId?: string;
}

const GOOGLE_CALENDAR_PROVIDER_CONFIG: OAuthProviderConfig = {
  connectorType: 'google-calendar',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  apiBaseUrl: 'https://www.googleapis.com/calendar/v3',
  scopes: [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.events.readonly',
  ],
  authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  errorPrefix: 'Google Calendar API error',
  authRoute: 'google-calendar',
};

export class GoogleCalendarClient extends OAuthClient<OAuthConfig> {
  protected getProviderConfig(): OAuthProviderConfig {
    return GOOGLE_CALENDAR_PROVIDER_CONFIG;
  }

  async listCalendars(): Promise<Calendar[]> {
    const response = await this.fetch<{ items: Calendar[] }>('/users/me/calendarList');
    return response.items || [];
  }

  async getEvents(
    calendarId: string = 'primary',
    options: {
      timeMin?: string;
      timeMax?: string;
      maxResults?: number;
      query?: string;
    } = {}
  ): Promise<CalendarEvent[]> {
    const params = new URLSearchParams({
      singleEvents: 'true',
      orderBy: 'startTime',
    });

    if (options.timeMin) {
      params.set('timeMin', options.timeMin);
    } else {
      // Default to now
      params.set('timeMin', new Date().toISOString());
    }

    if (options.timeMax) {
      params.set('timeMax', options.timeMax);
    }

    if (options.maxResults) {
      params.set('maxResults', options.maxResults.toString());
    }

    if (options.query) {
      params.set('q', options.query);
    }

    const response = await this.fetch<{ items: CalendarEvent[] }>(
      `/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`
    );

    return response.items || [];
  }

  async getEvent(calendarId: string, eventId: string): Promise<CalendarEvent> {
    return this.fetch<CalendarEvent>(
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`
    );
  }

  async getTodaysEvents(calendarId: string = 'primary'): Promise<CalendarEvent[]> {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    return this.getEvents(calendarId, {
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
    });
  }

  async getUpcomingEvents(
    calendarId: string = 'primary',
    days: number = 7,
    maxResults: number = 50
  ): Promise<CalendarEvent[]> {
    const now = new Date();
    const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    return this.getEvents(calendarId, {
      timeMin: now.toISOString(),
      timeMax: future.toISOString(),
      maxResults,
    });
  }

  async searchEvents(query: string, calendarId: string = 'primary'): Promise<CalendarEvent[]> {
    const now = new Date();
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    const oneYearAhead = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

    return this.getEvents(calendarId, {
      timeMin: oneYearAgo.toISOString(),
      timeMax: oneYearAhead.toISOString(),
      query,
      maxResults: 50,
    });
  }

  async getFreeBusy(
    timeMin: string,
    timeMax: string,
    calendarIds: string[] = ['primary']
  ): Promise<Record<string, { busy: Array<{ start: string; end: string }> }>> {
    const response = await this.fetchUrl<{
      calendars: Record<string, { busy: Array<{ start: string; end: string }> }>;
    }>(`${GOOGLE_CALENDAR_PROVIDER_CONFIG.apiBaseUrl}/freeBusy`, {
      method: 'POST',
      body: JSON.stringify({
        timeMin,
        timeMax,
        items: calendarIds.map((id) => ({ id })),
      }),
    });

    return response.calendars;
  }

  async testConnection(): Promise<void> {
    await this.listCalendars();
  }
}

// Helper function to build OAuth authorization URL
export function getGoogleCalendarAuthUrl(config: OAuthConfig, redirectUri: string): string {
  return buildOAuthAuthUrl(config, redirectUri, GOOGLE_CALENDAR_PROVIDER_CONFIG);
}

// Helper function to exchange auth code for tokens
export async function exchangeGoogleCalendarCode(
  config: OAuthConfig,
  code: string,
  redirectUri: string
): Promise<TokenResponse> {
  return exchangeOAuthCode(config, code, redirectUri, GOOGLE_CALENDAR_PROVIDER_CONFIG.tokenUrl);
}
