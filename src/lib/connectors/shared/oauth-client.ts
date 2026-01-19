import { db } from '@/lib/db';
import { encryptJson, decryptJson } from '@/lib/utils/crypto';
import type { ConnectorType } from '@/types';
import type { BaseConnectorConfig } from '../types';

/**
 * Standard OAuth token response from providers
 */
export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

/**
 * Configuration interface for OAuth-based connectors
 * All OAuth connectors share these common fields
 */
export interface OAuthConfig extends BaseConnectorConfig {
  clientId: string;
  clientSecret: string;
  refreshToken?: string;
}

/**
 * Configuration for OAuth provider endpoints and behavior
 */
export interface OAuthProviderConfig {
  /** The connector type identifier */
  connectorType: ConnectorType;
  /** Token refresh endpoint URL */
  tokenUrl: string;
  /** Base URL for API requests */
  apiBaseUrl: string;
  /** OAuth scopes required for this connector */
  scopes: string[];
  /** Authorization endpoint URL */
  authUrl: string;
  /** Error message prefix for this provider */
  errorPrefix: string;
  /** Path to append for OAuth authorization URL */
  authRoute: string;
}

/**
 * Base class for OAuth-based connector clients.
 * Handles token refresh, caching, and authenticated API requests.
 *
 * Subclasses must provide:
 * - Provider configuration via getProviderConfig()
 * - Any additional token refresh parameters via getAdditionalTokenParams()
 */
export abstract class OAuthClient<TConfig extends OAuthConfig = OAuthConfig> {
  protected config: TConfig;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(config: TConfig) {
    this.config = config;
  }

  /**
   * Provider-specific configuration
   */
  protected abstract getProviderConfig(): OAuthProviderConfig;

  /**
   * Additional parameters for token refresh (e.g., scope for Microsoft)
   * Override in subclass if needed
   */
  protected getAdditionalTokenParams(): Record<string, string> {
    return {};
  }

  /**
   * Whether to use Basic auth header for token requests (vs credentials in body)
   * Override in subclass to return true for providers like Yahoo
   */
  protected useBasicAuth(): boolean {
    return false;
  }

  /**
   * Override to provide a dynamic token URL (e.g., for Microsoft tenant-specific URLs)
   * By default returns the static URL from provider config
   */
  protected getTokenUrl(): string {
    return this.getProviderConfig().tokenUrl;
  }

  /**
   * Check if OAuth authorization has been completed
   */
  hasRefreshToken(): boolean {
    return !!this.config.refreshToken;
  }

  /**
   * Get a valid access token, refreshing if necessary
   */
  protected async getAccessToken(): Promise<string> {
    // Return cached token if still valid (with 60s buffer)
    if (this.accessToken && Date.now() < this.tokenExpiry - 60000) {
      return this.accessToken;
    }

    const providerConfig = this.getProviderConfig();

    if (!this.config.refreshToken) {
      throw new Error(
        `No refresh token available. Please complete OAuth authorization first by visiting /api/auth/${providerConfig.authRoute}.`
      );
    }

    // Build params - only include credentials if not using Basic auth
    const params = new URLSearchParams({
      refresh_token: this.config.refreshToken,
      grant_type: 'refresh_token',
      ...this.getAdditionalTokenParams(),
    });

    if (!this.useBasicAuth()) {
      params.set('client_id', this.config.clientId);
      params.set('client_secret', this.config.clientSecret);
    }

    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    if (this.useBasicAuth()) {
      const credentials = Buffer.from(
        `${this.config.clientId}:${this.config.clientSecret}`
      ).toString('base64');
      headers.Authorization = `Basic ${credentials}`;
    }

    const response = await fetch(this.getTokenUrl(), {
      method: 'POST',
      headers,
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to refresh token: ${error}`);
    }

    const data: TokenResponse = await response.json();

    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + data.expires_in * 1000;

    // If we got a new refresh token, persist it
    if (data.refresh_token && data.refresh_token !== this.config.refreshToken) {
      this.config.refreshToken = data.refresh_token;
      await this.updateRefreshToken(data.refresh_token);
    }

    return this.accessToken;
  }

  /**
   * Update the refresh token in the database
   */
  private async updateRefreshToken(refreshToken: string): Promise<void> {
    const providerConfig = this.getProviderConfig();

    try {
      const connector = await db.connector.findUnique({
        where: { type: providerConfig.connectorType },
      });

      if (connector) {
        const config = decryptJson<TConfig>(connector.config);
        config.refreshToken = refreshToken;
        await db.connector.update({
          where: { type: providerConfig.connectorType },
          data: { config: encryptJson(config) },
        });
      }
    } catch (error) {
      console.error('Failed to update refresh token:', error);
    }
  }

  /**
   * Make an authenticated API request
   */
  protected async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const token = await this.getAccessToken();
    const providerConfig = this.getProviderConfig();

    const response = await fetch(`${providerConfig.apiBaseUrl}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`${providerConfig.errorPrefix} (${response.status}): ${error}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Make an authenticated request that returns text (for file downloads, etc.)
   */
  protected async fetchText(endpoint: string, options?: RequestInit): Promise<string> {
    const token = await this.getAccessToken();
    const providerConfig = this.getProviderConfig();

    const response = await fetch(`${providerConfig.apiBaseUrl}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`${providerConfig.errorPrefix} (${response.status}): ${error}`);
    }

    return response.text();
  }

  /**
   * Make an authenticated request to a custom URL (for exports, downloads, etc.)
   */
  protected async fetchUrl<T>(url: string, options?: RequestInit): Promise<T> {
    const token = await this.getAccessToken();
    const providerConfig = this.getProviderConfig();

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`${providerConfig.errorPrefix} (${response.status}): ${error}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Make an authenticated text request to a custom URL
   */
  protected async fetchUrlText(url: string, options?: RequestInit): Promise<string> {
    const token = await this.getAccessToken();
    const providerConfig = this.getProviderConfig();

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`${providerConfig.errorPrefix} (${response.status}): Failed to fetch`);
    }

    return response.text();
  }
}

/**
 * Build an OAuth authorization URL
 */
export function buildOAuthAuthUrl(
  config: OAuthConfig,
  redirectUri: string,
  providerConfig: OAuthProviderConfig,
  additionalParams?: Record<string, string>
): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: providerConfig.scopes.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    ...additionalParams,
  });

  return `${providerConfig.authUrl}?${params.toString()}`;
}

/**
 * Exchange an authorization code for tokens
 */
export async function exchangeOAuthCode(
  config: OAuthConfig,
  code: string,
  redirectUri: string,
  tokenUrl: string,
  additionalParams?: Record<string, string>
): Promise<TokenResponse> {
  const params = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    ...additionalParams,
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange code for token: ${error}`);
  }

  return response.json();
}

/**
 * Exchange an authorization code for tokens using Basic auth header
 * Used by providers like Yahoo that require credentials in the header
 */
export async function exchangeOAuthCodeWithBasicAuth(
  config: OAuthConfig,
  code: string,
  redirectUri: string,
  tokenUrl: string
): Promise<TokenResponse> {
  const credentials = Buffer.from(
    `${config.clientId}:${config.clientSecret}`
  ).toString('base64');

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange code for token: ${error}`);
  }

  return response.json();
}
