import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { decryptJson, encryptJson } from '@/lib/utils/crypto';
import {
  exchangeOAuthCode,
  exchangeOAuthCodeWithBasicAuth,
  type OAuthConfig,
  type TokenResponse,
} from './oauth-client';
import type { ConnectorType } from '@/types';

/**
 * Configuration for OAuth callback handling
 */
export interface OAuthCallbackConfig {
  /** The connector type identifier */
  connectorType: ConnectorType;
  /** Display name for error messages */
  displayName: string;
  /** Token endpoint URL (ignored if customExchange is provided) */
  tokenUrl: string;
  /** Additional parameters for token exchange (e.g., scope for Microsoft) */
  additionalTokenParams?: Record<string, string>;
  /** Whether to use Basic auth header for token exchange (e.g., Yahoo) */
  useBasicAuth?: boolean;
  /** Custom exchange function for providers with dynamic token URLs (e.g., Microsoft with tenant ID) */
  customExchange?: (
    config: OAuthConfig,
    code: string,
    redirectUri: string
  ) => Promise<TokenResponse>;
}

/**
 * Configuration for OAuth initiation
 */
export interface OAuthInitConfig {
  /** The connector type identifier */
  connectorType: ConnectorType;
  /** Display name for error messages */
  displayName: string;
  /** Function to build the auth URL (receives OAuthConfig or extended config) */
  buildAuthUrl: (config: OAuthConfig, redirectUri: string) => string;
}

/**
 * Extended init config for connectors that need the full config (e.g., Outlook with tenantId)
 */
export interface OAuthInitConfigExtended<TConfig> {
  /** The connector type identifier */
  connectorType: ConnectorType;
  /** Display name for error messages */
  displayName: string;
  /** Function to build the auth URL with full config access */
  buildAuthUrl: (config: TConfig, redirectUri: string) => string;
}

/**
 * Handle OAuth callback - exchange code for tokens and store them
 */
export async function handleOAuthCallback(
  request: NextRequest,
  config: OAuthCallbackConfig
): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');

    if (error) {
      return NextResponse.redirect(
        new URL(`/settings/connectors?error=${encodeURIComponent(error)}`, url.origin)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL('/settings/connectors?error=No%20authorization%20code%20received', url.origin)
      );
    }

    const connector = await db.connector.findUnique({
      where: { type: config.connectorType },
    });

    if (!connector) {
      return NextResponse.redirect(
        new URL(
          `/settings/connectors?error=${encodeURIComponent(`${config.displayName} connector not found`)}`,
          url.origin
        )
      );
    }

    const connectorConfig = decryptJson<OAuthConfig>(connector.config);
    const redirectUri = `${url.origin}/api/auth/${config.connectorType}/callback`;

    let tokens: TokenResponse;
    if (config.customExchange) {
      // Use custom exchange function for providers with special requirements
      tokens = await config.customExchange(connectorConfig, code, redirectUri);
    } else if (config.useBasicAuth) {
      tokens = await exchangeOAuthCodeWithBasicAuth(
        connectorConfig,
        code,
        redirectUri,
        config.tokenUrl
      );
    } else {
      tokens = await exchangeOAuthCode(
        connectorConfig,
        code,
        redirectUri,
        config.tokenUrl,
        config.additionalTokenParams
      );
    }

    connectorConfig.refreshToken = tokens.refresh_token;

    await db.connector.update({
      where: { type: config.connectorType },
      data: {
        config: encryptJson(connectorConfig),
        enabled: true,
        lastHealthy: new Date(),
      },
    });

    return NextResponse.redirect(
      new URL(
        `/settings/connectors?success=${encodeURIComponent(`${config.displayName} connected successfully`)}`,
        url.origin
      )
    );
  } catch (error) {
    console.error(`${config.displayName} OAuth callback error:`, error);
    const url = new URL(request.url);
    const errorMessage = error instanceof Error ? error.message : 'OAuth callback failed';
    return NextResponse.redirect(
      new URL(`/settings/connectors?error=${encodeURIComponent(errorMessage)}`, url.origin)
    );
  }
}

/**
 * Handle OAuth initiation - redirect to provider's auth page
 */
export async function handleOAuthInit(
  request: NextRequest,
  config: OAuthInitConfig
): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const redirectUri = `${url.origin}/api/auth/${config.connectorType}/callback`;

    const connector = await db.connector.findUnique({
      where: { type: config.connectorType },
    });

    if (!connector) {
      return NextResponse.redirect(
        new URL(
          `/settings/connectors?error=${encodeURIComponent(`${config.displayName} connector not found`)}`,
          url.origin
        )
      );
    }

    const connectorConfig = decryptJson<OAuthConfig>(connector.config);
    const authUrl = config.buildAuthUrl(connectorConfig, redirectUri);

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error(`${config.displayName} auth error:`, error);
    const url = new URL(request.url);
    const errorMessage = error instanceof Error ? error.message : 'Failed to initiate authentication';
    return NextResponse.redirect(
      new URL(`/settings/connectors?error=${encodeURIComponent(errorMessage)}`, url.origin)
    );
  }
}

/**
 * Handle OAuth initiation for connectors with extended config requirements
 * Use this for connectors like Outlook that need access to additional config fields (e.g., tenantId)
 */
export async function handleOAuthInitExtended<TConfig>(
  request: NextRequest,
  config: OAuthInitConfigExtended<TConfig>
): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const redirectUri = `${url.origin}/api/auth/${config.connectorType}/callback`;

    const connector = await db.connector.findUnique({
      where: { type: config.connectorType },
    });

    if (!connector) {
      return NextResponse.redirect(
        new URL(
          `/settings/connectors?error=${encodeURIComponent(`${config.displayName} connector not found`)}`,
          url.origin
        )
      );
    }

    const connectorConfig = decryptJson<TConfig>(connector.config);
    const authUrl = config.buildAuthUrl(connectorConfig, redirectUri);

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error(`${config.displayName} auth error:`, error);
    const url = new URL(request.url);
    const errorMessage = error instanceof Error ? error.message : 'Failed to initiate authentication';
    return NextResponse.redirect(
      new URL(`/settings/connectors?error=${encodeURIComponent(errorMessage)}`, url.origin)
    );
  }
}
