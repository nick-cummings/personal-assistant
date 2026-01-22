import {
    buildOAuthAuthUrl,
    exchangeOAuthCode, OAuthClient, type OAuthConfig,
    type OAuthProviderConfig,
    type TokenResponse
} from '../shared/oauth-client';

interface Document {
  documentId: string;
  title: string;
  body?: DocumentBody;
  revisionId?: string;
}

interface DocumentBody {
  content: StructuralElement[];
}

interface StructuralElement {
  startIndex?: number;
  endIndex?: number;
  paragraph?: Paragraph;
  table?: Table;
  sectionBreak?: object;
}

interface Paragraph {
  elements: ParagraphElement[];
  paragraphStyle?: {
    namedStyleType?: string;
    headingId?: string;
  };
}

interface ParagraphElement {
  startIndex?: number;
  endIndex?: number;
  textRun?: {
    content: string;
    textStyle?: object;
  };
}

interface Table {
  rows: number;
  columns: number;
  tableRows: TableRow[];
}

interface TableRow {
  tableCells: TableCell[];
}

interface TableCell {
  content: StructuralElement[];
}

const GOOGLE_DOCS_PROVIDER_CONFIG: OAuthProviderConfig = {
  connectorType: 'google-docs',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  // Primary API is Docs, but we also use Drive for listing
  apiBaseUrl: 'https://docs.googleapis.com/v1',
  scopes: [
    'https://www.googleapis.com/auth/documents.readonly',
    'https://www.googleapis.com/auth/drive.readonly',
  ],
  authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  errorPrefix: 'Google Docs API error',
  authRoute: 'google-docs',
};

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';

export class GoogleDocsClient extends OAuthClient<OAuthConfig> {
  protected getProviderConfig(): OAuthProviderConfig {
    return GOOGLE_DOCS_PROVIDER_CONFIG;
  }

  // Drive API requests for listing documents
  private async fetchDrive<T>(endpoint: string): Promise<T> {
    return this.fetchUrl<T>(`${DRIVE_API_BASE}${endpoint}`);
  }

  async getDocument(documentId: string): Promise<Document> {
    return this.fetch<Document>(`/documents/${documentId}`);
  }

  async getDocumentText(documentId: string): Promise<string> {
    const doc = await this.getDocument(documentId);
    return this.extractText(doc);
  }

  private extractText(doc: Document): string {
    if (!doc.body?.content) {
      return '';
    }

    const textParts: string[] = [];

    for (const element of doc.body.content) {
      if (element.paragraph) {
        const paragraphText = this.extractParagraphText(element.paragraph);
        if (paragraphText) {
          textParts.push(paragraphText);
        }
      } else if (element.table) {
        const tableText = this.extractTableText(element.table);
        if (tableText) {
          textParts.push(tableText);
        }
      }
    }

    return textParts.join('\n');
  }

  private extractParagraphText(paragraph: Paragraph): string {
    const parts: string[] = [];

    for (const element of paragraph.elements) {
      if (element.textRun?.content) {
        parts.push(element.textRun.content);
      }
    }

    return parts.join('');
  }

  private extractTableText(table: Table): string {
    const rows: string[] = [];

    for (const tableRow of table.tableRows) {
      const cells: string[] = [];
      for (const cell of tableRow.tableCells) {
        const cellText: string[] = [];
        for (const element of cell.content) {
          if (element.paragraph) {
            cellText.push(this.extractParagraphText(element.paragraph).trim());
          }
        }
        cells.push(cellText.join(' '));
      }
      rows.push(cells.join(' | '));
    }

    return rows.join('\n');
  }

  async listDocuments(
    query?: string,
    maxResults: number = 20
  ): Promise<
    Array<{
      id: string;
      name: string;
      modifiedTime: string;
      webViewLink: string;
    }>
  > {
    const params = new URLSearchParams({
      pageSize: maxResults.toString(),
      fields: 'files(id,name,modifiedTime,webViewLink)',
    });

    const queryParts = ["mimeType = 'application/vnd.google-apps.document'", 'trashed = false'];
    if (query) {
      queryParts.push(`name contains '${query}'`);
    }

    params.set('q', queryParts.join(' and '));

    const response = await this.fetchDrive<{
      files: Array<{ id: string; name: string; modifiedTime: string; webViewLink: string }>;
    }>(`/files?${params.toString()}`);

    return response.files || [];
  }

  async searchDocuments(query: string): Promise<
    Array<{
      id: string;
      name: string;
      modifiedTime: string;
      webViewLink: string;
    }>
  > {
    const params = new URLSearchParams({
      pageSize: '50',
      fields: 'files(id,name,modifiedTime,webViewLink)',
    });

    params.set(
      'q',
      `mimeType = 'application/vnd.google-apps.document' and fullText contains '${query}' and trashed = false`
    );

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
export function getGoogleDocsAuthUrl(config: OAuthConfig, redirectUri: string): string {
  return buildOAuthAuthUrl(config, redirectUri, GOOGLE_DOCS_PROVIDER_CONFIG);
}

// Helper function to exchange auth code for tokens
export async function exchangeGoogleDocsCode(
  config: OAuthConfig,
  code: string,
  redirectUri: string
): Promise<TokenResponse> {
  return exchangeOAuthCode(config, code, redirectUri, GOOGLE_DOCS_PROVIDER_CONFIG.tokenUrl);
}
