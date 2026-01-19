import {
  OAuthClient,
  exchangeOAuthCodeWithBasicAuth,
  type OAuthConfig,
  type OAuthProviderConfig,
  type TokenResponse,
} from '../shared/oauth-client';

interface YahooEmail {
  id: string;
  threadId?: string;
  subject: string;
  from: string;
  to: string[];
  date: string;
  snippet: string;
  body?: string;
  isRead: boolean;
  hasAttachments: boolean;
}

interface YahooFolder {
  id: string;
  name: string;
  messageCount: number;
  unreadCount: number;
}

const YAHOO_PROVIDER_CONFIG: OAuthProviderConfig = {
  connectorType: 'yahoo',
  tokenUrl: 'https://api.login.yahoo.com/oauth2/get_token',
  apiBaseUrl: 'https://api.mail.yahoo.com/ws/mail/v3.0',
  scopes: ['mail-r'],
  authUrl: 'https://api.login.yahoo.com/oauth2/request_auth',
  errorPrefix: 'Yahoo API error',
  authRoute: 'yahoo',
};

export class YahooClient extends OAuthClient<OAuthConfig> {
  protected getProviderConfig(): OAuthProviderConfig {
    return YAHOO_PROVIDER_CONFIG;
  }

  // Yahoo uses Basic auth for token refresh
  protected useBasicAuth(): boolean {
    return true;
  }

  async searchEmails(query: string, maxResults: number = 20): Promise<YahooEmail[]> {
    const params = new URLSearchParams({
      query,
      count: maxResults.toString(),
    });

    const response = await this.fetch<{ messages?: Array<Record<string, unknown>> }>(
      `/messages/search?${params.toString()}`
    );

    if (!response.messages) {
      return [];
    }

    return response.messages.map((msg) => this.parseMessage(msg));
  }

  async getEmail(messageId: string): Promise<YahooEmail> {
    const response = await this.fetch<{ message: Record<string, unknown> }>(
      `/messages/${messageId}`
    );

    return this.parseMessage(response.message, true);
  }

  async listFolders(): Promise<YahooFolder[]> {
    const response = await this.fetch<{ folders?: Array<Record<string, unknown>> }>(
      '/folders'
    );

    if (!response.folders) {
      return [];
    }

    return response.folders.map((folder) => ({
      id: String(folder.folderId || folder.id || ''),
      name: String(folder.name || 'Unknown'),
      messageCount: Number(folder.total || 0),
      unreadCount: Number(folder.unseen || 0),
    }));
  }

  async getEmailsInFolder(folderId: string, maxResults: number = 20): Promise<YahooEmail[]> {
    const params = new URLSearchParams({
      count: maxResults.toString(),
    });

    const response = await this.fetch<{ messages?: Array<Record<string, unknown>> }>(
      `/folders/${folderId}/messages?${params.toString()}`
    );

    if (!response.messages) {
      return [];
    }

    return response.messages.map((msg) => this.parseMessage(msg));
  }

  private parseMessage(msg: Record<string, unknown>, includeBody: boolean = false): YahooEmail {
    const headers = (msg.headers || {}) as Record<string, unknown>;
    const from = headers.from as { email?: string; name?: string } | undefined;
    const to = (headers.to || []) as Array<{ email?: string; name?: string }>;

    return {
      id: String(msg.messageId || msg.id || ''),
      threadId: msg.threadId as string | undefined,
      subject: String(headers.subject || '(No Subject)'),
      from: from ? `${from.name || ''} <${from.email || ''}>`.trim() : 'Unknown',
      to: to.map((t) => `${t.name || ''} <${t.email || ''}>`.trim()),
      date: String(headers.date || msg.receivedDate || ''),
      snippet: String(msg.snippet || ''),
      body: includeBody ? this.extractBody(msg) : undefined,
      isRead: Boolean(msg.read || msg.isRead),
      hasAttachments: Boolean(msg.hasAttachment || (msg.attachments as unknown[])?.length > 0),
    };
  }

  private extractBody(msg: Record<string, unknown>): string {
    const parts = msg.parts as Array<{ mimeType?: string; body?: { data?: string } }> | undefined;

    if (!parts || parts.length === 0) {
      const body = msg.body as { data?: string } | string | undefined;
      if (typeof body === 'string') return body;
      if (body?.data) return Buffer.from(body.data, 'base64').toString('utf-8');
      return '';
    }

    // Prefer plain text, then HTML
    const textPart = parts.find((p) => p.mimeType === 'text/plain');
    const htmlPart = parts.find((p) => p.mimeType === 'text/html');

    const part = textPart || htmlPart;
    if (part?.body?.data) {
      return Buffer.from(part.body.data, 'base64').toString('utf-8');
    }

    return '';
  }

  async testConnection(): Promise<void> {
    await this.listFolders();
  }
}

// Helper function to build OAuth authorization URL
export function getYahooAuthUrl(config: OAuthConfig, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: YAHOO_PROVIDER_CONFIG.scopes.join(' '),
  });

  return `${YAHOO_PROVIDER_CONFIG.authUrl}?${params.toString()}`;
}

// Helper function to exchange auth code for tokens
export async function exchangeYahooCode(
  config: OAuthConfig,
  code: string,
  redirectUri: string
): Promise<TokenResponse> {
  return exchangeOAuthCodeWithBasicAuth(
    config,
    code,
    redirectUri,
    YAHOO_PROVIDER_CONFIG.tokenUrl
  );
}
