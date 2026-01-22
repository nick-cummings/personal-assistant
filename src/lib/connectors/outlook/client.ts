import {
    exchangeOAuthCode, OAuthClient, type OAuthProviderConfig,
    type TokenResponse
} from '../shared/oauth-client';
import type { OutlookConfig } from '../types';

// Microsoft Graph API types
interface GraphMessage {
  id: string;
  subject: string;
  bodyPreview: string;
  body?: {
    contentType: string;
    content: string;
  };
  from: {
    emailAddress: {
      name: string;
      address: string;
    };
  };
  toRecipients: Array<{
    emailAddress: {
      name: string;
      address: string;
    };
  }>;
  receivedDateTime: string;
  sentDateTime: string;
  isRead: boolean;
  importance: string;
  hasAttachments: boolean;
  webLink: string;
}

interface GraphEvent {
  id: string;
  subject: string;
  bodyPreview: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  location?: {
    displayName: string;
  };
  organizer: {
    emailAddress: {
      name: string;
      address: string;
    };
  };
  attendees: Array<{
    emailAddress: {
      name: string;
      address: string;
    };
    status: {
      response: string;
    };
  }>;
  isOnlineMeeting: boolean;
  onlineMeetingUrl?: string;
  webLink: string;
}

interface GraphMailFolder {
  id: string;
  displayName: string;
  parentFolderId?: string;
  childFolderCount: number;
  unreadItemCount: number;
  totalItemCount: number;
}

const OUTLOOK_SCOPES = [
  'https://graph.microsoft.com/Mail.Read',
  'https://graph.microsoft.com/Calendars.Read',
  'offline_access',
];

const OUTLOOK_PROVIDER_CONFIG: OAuthProviderConfig = {
  connectorType: 'outlook',
  // tokenUrl is dynamic (tenant-specific), will be overridden
  tokenUrl: '',
  apiBaseUrl: 'https://graph.microsoft.com/v1.0',
  scopes: OUTLOOK_SCOPES,
  // authUrl is dynamic (tenant-specific), will be built manually
  authUrl: '',
  errorPrefix: 'Microsoft Graph API error',
  authRoute: 'outlook',
};

export class OutlookClient extends OAuthClient<OutlookConfig> {
  protected getProviderConfig(): OAuthProviderConfig {
    return OUTLOOK_PROVIDER_CONFIG;
  }

  // Microsoft requires tenant-specific token URL
  protected getTokenUrl(): string {
    return `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/token`;
  }

  // Microsoft requires scope in token refresh params
  protected getAdditionalTokenParams(): Record<string, string> {
    return {
      scope: OUTLOOK_SCOPES.join(' '),
    };
  }

  async searchEmails(query: string, folder?: string, limit: number = 20): Promise<GraphMessage[]> {
    const folderPath = folder ? `/mailFolders/${encodeURIComponent(folder)}` : '';
    const searchQuery = encodeURIComponent(query);

    const response = await this.fetch<{ value: GraphMessage[] }>(
      `/me${folderPath}/messages?$search="${searchQuery}"&$top=${limit}&$select=id,subject,bodyPreview,from,toRecipients,receivedDateTime,sentDateTime,isRead,importance,hasAttachments,webLink`
    );

    return response.value;
  }

  async getEmail(messageId: string): Promise<GraphMessage> {
    return this.fetch<GraphMessage>(
      `/me/messages/${messageId}?$select=id,subject,body,bodyPreview,from,toRecipients,receivedDateTime,sentDateTime,isRead,importance,hasAttachments,webLink`
    );
  }

  async listFolders(): Promise<GraphMailFolder[]> {
    const response = await this.fetch<{ value: GraphMailFolder[] }>(
      '/me/mailFolders?$top=50&$select=id,displayName,parentFolderId,childFolderCount,unreadItemCount,totalItemCount'
    );
    return response.value;
  }

  async getCalendarEvents(startDate: string, endDate: string): Promise<GraphEvent[]> {
    const start = new Date(startDate).toISOString();
    const end = new Date(endDate).toISOString();

    const response = await this.fetch<{ value: GraphEvent[] }>(
      `/me/calendarView?startDateTime=${start}&endDateTime=${end}&$top=50&$orderby=start/dateTime&$select=id,subject,bodyPreview,start,end,location,organizer,attendees,isOnlineMeeting,onlineMeetingUrl,webLink`
    );

    return response.value;
  }

  async testConnection(): Promise<void> {
    await this.fetch('/me');
  }
}

// Helper function to build OAuth authorization URL
export function getOutlookAuthUrl(config: OutlookConfig, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: OUTLOOK_SCOPES.join(' '),
    state: 'outlook_auth',
  });

  return `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
}

// Helper function to exchange auth code for tokens
export async function exchangeOutlookCode(
  config: OutlookConfig,
  code: string,
  redirectUri: string
): Promise<TokenResponse> {
  const tokenUrl = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`;

  return exchangeOAuthCode(config, code, redirectUri, tokenUrl, {
    scope: OUTLOOK_SCOPES.join(' '),
  });
}
