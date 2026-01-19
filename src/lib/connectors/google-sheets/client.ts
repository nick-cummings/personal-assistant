import {
  OAuthClient,
  buildOAuthAuthUrl,
  exchangeOAuthCode,
  type OAuthConfig,
  type OAuthProviderConfig,
  type TokenResponse,
} from '../shared/oauth-client';

interface Spreadsheet {
  spreadsheetId: string;
  properties: {
    title: string;
    locale?: string;
    timeZone?: string;
  };
  sheets: Sheet[];
  spreadsheetUrl?: string;
}

interface Sheet {
  properties: {
    sheetId: number;
    title: string;
    index: number;
    sheetType: string;
    gridProperties?: {
      rowCount: number;
      columnCount: number;
    };
  };
}

interface ValueRange {
  range: string;
  majorDimension: string;
  values: string[][];
}

const GOOGLE_SHEETS_PROVIDER_CONFIG: OAuthProviderConfig = {
  connectorType: 'google-sheets',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  // Primary API is Sheets, but we also use Drive for listing
  apiBaseUrl: 'https://sheets.googleapis.com/v4',
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets.readonly',
    'https://www.googleapis.com/auth/drive.readonly',
  ],
  authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  errorPrefix: 'Google Sheets API error',
  authRoute: 'google-sheets',
};

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';

export class GoogleSheetsClient extends OAuthClient<OAuthConfig> {
  protected getProviderConfig(): OAuthProviderConfig {
    return GOOGLE_SHEETS_PROVIDER_CONFIG;
  }

  // Drive API requests for listing spreadsheets
  private async fetchDrive<T>(endpoint: string): Promise<T> {
    return this.fetchUrl<T>(`${DRIVE_API_BASE}${endpoint}`);
  }

  async getSpreadsheet(spreadsheetId: string): Promise<Spreadsheet> {
    return this.fetch<Spreadsheet>(`/spreadsheets/${spreadsheetId}`);
  }

  async getSheetValues(spreadsheetId: string, range: string): Promise<string[][]> {
    const response = await this.fetch<ValueRange>(
      `/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`
    );
    return response.values || [];
  }

  async getSheetAsTable(
    spreadsheetId: string,
    sheetName: string,
    maxRows: number = 100
  ): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
    const range = `${sheetName}!A1:ZZ${maxRows + 1}`;
    const values = await this.getSheetValues(spreadsheetId, range);

    if (values.length === 0) {
      return { headers: [], rows: [] };
    }

    const headers = values[0];
    const rows = values.slice(1).map((row) => {
      const obj: Record<string, string> = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] || '';
      });
      return obj;
    });

    return { headers, rows };
  }

  async listSpreadsheets(query?: string, maxResults: number = 20): Promise<Array<{
    id: string;
    name: string;
    modifiedTime: string;
    webViewLink: string;
  }>> {
    const params = new URLSearchParams({
      pageSize: maxResults.toString(),
      fields: 'files(id,name,modifiedTime,webViewLink)',
    });

    const queryParts = ["mimeType = 'application/vnd.google-apps.spreadsheet'", "trashed = false"];
    if (query) {
      queryParts.push(`name contains '${query}'`);
    }

    params.set('q', queryParts.join(' and '));

    const response = await this.fetchDrive<{
      files: Array<{ id: string; name: string; modifiedTime: string; webViewLink: string }>;
    }>(`/files?${params.toString()}`);

    return response.files || [];
  }

  async searchSpreadsheets(query: string): Promise<Array<{
    id: string;
    name: string;
    modifiedTime: string;
    webViewLink: string;
  }>> {
    const params = new URLSearchParams({
      pageSize: '50',
      fields: 'files(id,name,modifiedTime,webViewLink)',
    });

    params.set('q', `mimeType = 'application/vnd.google-apps.spreadsheet' and fullText contains '${query}' and trashed = false`);

    const response = await this.fetchDrive<{
      files: Array<{ id: string; name: string; modifiedTime: string; webViewLink: string }>;
    }>(`/files?${params.toString()}`);

    return response.files || [];
  }

  async testConnection(): Promise<void> {
    await this.fetchDrive('/about?fields=user');
  }
}

// Helper function to build OAuth authorization URL
export function getGoogleSheetsAuthUrl(config: OAuthConfig, redirectUri: string): string {
  return buildOAuthAuthUrl(config, redirectUri, GOOGLE_SHEETS_PROVIDER_CONFIG);
}

// Helper function to exchange auth code for tokens
export async function exchangeGoogleSheetsCode(
  config: OAuthConfig,
  code: string,
  redirectUri: string
): Promise<TokenResponse> {
  return exchangeOAuthCode(config, code, redirectUri, GOOGLE_SHEETS_PROVIDER_CONFIG.tokenUrl);
}
