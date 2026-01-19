import {
  OAuthClient,
  buildOAuthAuthUrl,
  exchangeOAuthCode,
  type OAuthConfig,
  type OAuthProviderConfig,
  type TokenResponse,
} from '../shared/oauth-client';

// Gmail API response types
interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  payload: {
    headers: Array<{
      name: string;
      value: string;
    }>;
    mimeType: string;
    body?: {
      size: number;
      data?: string;
    };
    parts?: Array<{
      mimeType: string;
      body?: {
        size: number;
        data?: string;
      };
    }>;
  };
  internalDate: string;
}

interface GmailMessageList {
  messages?: Array<{
    id: string;
    threadId: string;
  }>;
  nextPageToken?: string;
  resultSizeEstimate: number;
}

interface GmailLabel {
  id: string;
  name: string;
  messageListVisibility?: string;
  labelListVisibility?: string;
  type: string;
  messagesTotal?: number;
  messagesUnread?: number;
}

const GMAIL_PROVIDER_CONFIG: OAuthProviderConfig = {
  connectorType: 'gmail',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  apiBaseUrl: 'https://gmail.googleapis.com/gmail/v1',
  scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
  authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  errorPrefix: 'Gmail API error',
  authRoute: 'gmail',
};

export class GmailClient extends OAuthClient<OAuthConfig> {
  protected getProviderConfig(): OAuthProviderConfig {
    return GMAIL_PROVIDER_CONFIG;
  }

  async searchEmails(query: string, maxResults: number = 20): Promise<GmailMessage[]> {
    // First get message IDs
    const listResponse = await this.fetch<GmailMessageList>(
      `/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`
    );

    if (!listResponse.messages || listResponse.messages.length === 0) {
      return [];
    }

    // Then fetch full message details for each
    const messages: GmailMessage[] = [];
    for (const msg of listResponse.messages) {
      const fullMessage = await this.fetch<GmailMessage>(
        `/users/me/messages/${msg.id}?format=full`
      );
      messages.push(fullMessage);
    }

    return messages;
  }

  async getEmail(messageId: string): Promise<GmailMessage> {
    return this.fetch<GmailMessage>(`/users/me/messages/${messageId}?format=full`);
  }

  async listLabels(): Promise<GmailLabel[]> {
    const response = await this.fetch<{ labels: GmailLabel[] }>('/users/me/labels');
    return response.labels;
  }

  async testConnection(): Promise<void> {
    await this.fetch('/users/me/profile');
  }

  // Helper to extract header value
  static getHeader(message: GmailMessage, name: string): string | undefined {
    const header = message.payload.headers.find(
      (h) => h.name.toLowerCase() === name.toLowerCase()
    );
    return header?.value;
  }

  // Helper to decode base64url encoded content
  static decodeBody(data: string): string {
    // Gmail uses URL-safe base64 encoding
    const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(base64, 'base64').toString('utf-8');
  }

  // Helper to get plain text body from message
  static getPlainTextBody(message: GmailMessage): string {
    // Try to find text/plain part
    if (message.payload.parts) {
      const textPart = message.payload.parts.find((p) => p.mimeType === 'text/plain');
      if (textPart?.body?.data) {
        return GmailClient.decodeBody(textPart.body.data);
      }
      // Fall back to html and strip tags
      const htmlPart = message.payload.parts.find((p) => p.mimeType === 'text/html');
      if (htmlPart?.body?.data) {
        const html = GmailClient.decodeBody(htmlPart.body.data);
        return html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      }
    }
    // Single part message
    if (message.payload.body?.data) {
      return GmailClient.decodeBody(message.payload.body.data);
    }
    return message.snippet;
  }
}

// Helper function to build OAuth authorization URL
export function getGmailAuthUrl(config: OAuthConfig, redirectUri: string): string {
  return buildOAuthAuthUrl(config, redirectUri, GMAIL_PROVIDER_CONFIG, {
    state: 'gmail_auth',
  });
}

// Helper function to exchange auth code for tokens
export async function exchangeGmailCode(
  config: OAuthConfig,
  code: string,
  redirectUri: string
): Promise<TokenResponse> {
  return exchangeOAuthCode(config, code, redirectUri, GMAIL_PROVIDER_CONFIG.tokenUrl);
}
