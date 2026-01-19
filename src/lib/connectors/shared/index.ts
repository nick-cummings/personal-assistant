// Shared utilities for OAuth-based connectors
export {
  OAuthClient,
  buildOAuthAuthUrl,
  exchangeOAuthCode,
  exchangeOAuthCodeWithBasicAuth,
  type OAuthConfig,
  type OAuthProviderConfig,
  type TokenResponse,
} from './oauth-client';

export {
  handleOAuthCallback,
  handleOAuthInit,
  handleOAuthInitExtended,
  type OAuthCallbackConfig,
  type OAuthInitConfig,
  type OAuthInitConfigExtended,
} from './oauth-handler';
