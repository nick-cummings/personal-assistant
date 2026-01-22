import {
    buildOAuthAuthUrl,
    exchangeOAuthCode, OAuthClient, type OAuthConfig,
    type OAuthProviderConfig,
    type TokenResponse
} from '../shared/oauth-client';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime?: string;
  modifiedTime?: string;
  webViewLink?: string;
  parents?: string[];
  owners?: Array<{ displayName: string; emailAddress: string }>;
}

interface DriveFolder {
  id: string;
  name: string;
  parents?: string[];
}

const GOOGLE_DRIVE_PROVIDER_CONFIG: OAuthProviderConfig = {
  connectorType: 'google-drive',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  apiBaseUrl: 'https://www.googleapis.com/drive/v3',
  scopes: [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/drive.metadata.readonly',
  ],
  authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  errorPrefix: 'Google Drive API error',
  authRoute: 'google-drive',
};

export class GoogleDriveClient extends OAuthClient<OAuthConfig> {
  protected getProviderConfig(): OAuthProviderConfig {
    return GOOGLE_DRIVE_PROVIDER_CONFIG;
  }

  async listFiles(
    query?: string,
    pageSize: number = 20,
    folderId?: string
  ): Promise<{ files: DriveFile[]; nextPageToken?: string }> {
    const params = new URLSearchParams({
      pageSize: pageSize.toString(),
      fields:
        'nextPageToken,files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink,parents,owners)',
    });

    const queryParts: string[] = [];
    if (query) {
      queryParts.push(`name contains '${query}' or fullText contains '${query}'`);
    }
    if (folderId) {
      queryParts.push(`'${folderId}' in parents`);
    }
    queryParts.push('trashed = false');

    params.set('q', queryParts.join(' and '));

    return this.fetch<{ files: DriveFile[]; nextPageToken?: string }>(
      `/files?${params.toString()}`
    );
  }

  async getFile(fileId: string): Promise<DriveFile> {
    const params = new URLSearchParams({
      fields: 'id,name,mimeType,size,createdTime,modifiedTime,webViewLink,parents,owners',
    });

    return this.fetch<DriveFile>(`/files/${fileId}?${params.toString()}`);
  }

  async getFileContent(fileId: string): Promise<string> {
    // First get the file metadata to check the type
    const file = await this.getFile(fileId);

    // For Google Docs/Sheets/Slides, export as plain text or CSV
    let exportUrl: string;
    if (file.mimeType === 'application/vnd.google-apps.document') {
      exportUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`;
    } else if (file.mimeType === 'application/vnd.google-apps.spreadsheet') {
      exportUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/csv`;
    } else if (file.mimeType === 'application/vnd.google-apps.presentation') {
      exportUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`;
    } else {
      // For regular files, download content
      exportUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    }

    return this.fetchUrlText(exportUrl);
  }

  async listFolders(parentId?: string): Promise<DriveFolder[]> {
    const params = new URLSearchParams({
      pageSize: '100',
      fields: 'files(id,name,parents)',
    });

    const queryParts = ["mimeType = 'application/vnd.google-apps.folder'", 'trashed = false'];
    if (parentId) {
      queryParts.push(`'${parentId}' in parents`);
    }

    params.set('q', queryParts.join(' and '));

    const response = await this.fetch<{ files: DriveFolder[] }>(`/files?${params.toString()}`);

    return response.files || [];
  }

  async searchFiles(query: string, mimeType?: string): Promise<DriveFile[]> {
    const params = new URLSearchParams({
      pageSize: '50',
      fields: 'files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink,owners)',
    });

    const queryParts = [`fullText contains '${query}'`, 'trashed = false'];
    if (mimeType) {
      queryParts.push(`mimeType = '${mimeType}'`);
    }

    params.set('q', queryParts.join(' and '));

    const response = await this.fetch<{ files: DriveFile[] }>(`/files?${params.toString()}`);

    return response.files || [];
  }

  async testConnection(): Promise<void> {
    await this.fetch('/about?fields=user');
  }
}

// Helper function to build OAuth authorization URL
export function getGoogleDriveAuthUrl(config: OAuthConfig, redirectUri: string): string {
  return buildOAuthAuthUrl(config, redirectUri, GOOGLE_DRIVE_PROVIDER_CONFIG);
}

// Helper function to exchange auth code for tokens
export async function exchangeGoogleDriveCode(
  config: OAuthConfig,
  code: string,
  redirectUri: string
): Promise<TokenResponse> {
  return exchangeOAuthCode(config, code, redirectUri, GOOGLE_DRIVE_PROVIDER_CONFIG.tokenUrl);
}
