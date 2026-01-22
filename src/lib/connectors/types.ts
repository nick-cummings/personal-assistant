import type { ConnectorType } from '@/types';
import type { Tool } from 'ai';
import type { OAuthConfig } from './shared/oauth-client';

// Tool result returned by connector tool execution
export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// Connection test result
export interface ConnectionTestResult {
  success: boolean;
  error?: string;
}

// Base connector configuration (stored encrypted in DB)
export interface BaseConnectorConfig {
  [key: string]: unknown;
}

// GitHub connector config
export interface GitHubConfig extends BaseConnectorConfig {
  token: string;
  defaultOwner?: string;
}

// Atlassian instance configuration (shared between Jira and Confluence)
export interface AtlassianInstance {
  name: string; // Display name like "Work", "Client A", etc.
  host: string; // e.g., "company.atlassian.net"
  email: string;
  apiToken: string;
}

// Jira connector config - supports multiple instances
export interface JiraConfig extends BaseConnectorConfig {
  // Multi-instance config (preferred)
  instances?: AtlassianInstance[];
  // Legacy single-instance fields for backward compatibility
  host?: string;
  email?: string;
  apiToken?: string;
}

// Confluence connector config - supports multiple instances
export interface ConfluenceConfig extends BaseConnectorConfig {
  // Multi-instance config (preferred)
  instances?: AtlassianInstance[];
  // Legacy single-instance fields for backward compatibility
  host?: string;
  email?: string;
  apiToken?: string;
}

// Jenkins connector config
export interface JenkinsConfig extends BaseConnectorConfig {
  url: string;
  username: string;
  apiToken: string;
}

// AWS connector config
export interface AWSConfig extends BaseConnectorConfig {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

// Outlook connector config
export interface OutlookConfig extends BaseConnectorConfig {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  refreshToken?: string;
}

// Standard OAuth connector config (used by Gmail, Yahoo, Google services)
// Re-exported from shared module for convenience
export type { OAuthConfig } from './shared/oauth-client';

// Gmail connector config (IMAP with App Password)
export interface GmailConfig extends BaseConnectorConfig {
  email: string;
  appPassword: string;
}

// Yahoo Mail connector config (IMAP with App Password)
export interface YahooConfig extends BaseConnectorConfig {
  email: string;
  appPassword: string;
}

// Google Drive connector config (Google OAuth)
export type GoogleDriveConfig = OAuthConfig;

// Google Docs connector config (Google OAuth)
export type GoogleDocsConfig = OAuthConfig;

// Google Sheets connector config (Google OAuth)
export type GoogleSheetsConfig = OAuthConfig;

// Google Calendar connector config (Google OAuth)
export type GoogleCalendarConfig = OAuthConfig;

// Google Cloud connector config (Service Account)
export interface GoogleCloudConfig extends BaseConnectorConfig {
  projectId: string;
  clientEmail: string;
  privateKey: string;
  region?: string;
}

// Map connector types to their config types
export type ConnectorConfigMap = {
  github: GitHubConfig;
  jira: JiraConfig;
  confluence: ConfluenceConfig;
  jenkins: JenkinsConfig;
  aws: AWSConfig;
  outlook: OutlookConfig;
  gmail: GmailConfig;
  yahoo: YahooConfig;
  'google-drive': GoogleDriveConfig;
  'google-docs': GoogleDocsConfig;
  'google-sheets': GoogleSheetsConfig;
  'google-calendar': GoogleCalendarConfig;
  'google-cloud': GoogleCloudConfig;
};

// Generic connector config type
export type ConnectorConfig<T extends ConnectorType> = ConnectorConfigMap[T];

// Tool set type for AI SDK - uses any for input/output to accept any tool
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ToolSet = Record<string, Tool<any, any>>;

// Connector interface that all connectors must implement
export interface Connector<T extends ConnectorType = ConnectorType> {
  type: T;
  name: string;

  // Get AI SDK tools for this connector as a record
  getTools(): ToolSet;

  // Test the connection/credentials
  testConnection(): Promise<ConnectionTestResult>;
}

// Connector constructor type
export type ConnectorConstructor<T extends ConnectorType> = new (
  config: ConnectorConfigMap[T]
) => Connector<T>;

// Connector metadata for UI
export interface ConnectorMetadata {
  type: ConnectorType;
  name: string;
  description: string;
  configFields: ConfigField[];
  setupInstructions: string;
}

// Config field for UI form generation
export interface ConfigField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url' | 'email';
  placeholder?: string;
  required: boolean;
  helpText?: string;
}
