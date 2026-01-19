// Main entry point for connectors
// Registers all available connector implementations

import { registerConnector } from './registry';
import { GitHubConnector } from './github';
import { JiraConnector } from './jira';
import { AWSConnector } from './aws';
import { ConfluenceConnector } from './confluence';
import { JenkinsConnector } from './jenkins';
import { OutlookConnector } from './outlook';
import { GmailConnector } from './gmail';
import { YahooConnector } from './yahoo';
import { GoogleDriveConnector } from './google-drive';
import { GoogleDocsConnector } from './google-docs';
import { GoogleSheetsConnector } from './google-sheets';
import { GoogleCalendarConnector } from './google-calendar';
import { GoogleCloudConnector } from './google-cloud';

// Register all connectors
registerConnector('github', GitHubConnector);
registerConnector('jira', JiraConnector);
registerConnector('aws', AWSConnector);
registerConnector('confluence', ConfluenceConnector);
registerConnector('jenkins', JenkinsConnector);
registerConnector('outlook', OutlookConnector);
registerConnector('gmail', GmailConnector);
registerConnector('yahoo', YahooConnector);
registerConnector('google-drive', GoogleDriveConnector);
registerConnector('google-docs', GoogleDocsConnector);
registerConnector('google-sheets', GoogleSheetsConnector);
registerConnector('google-calendar', GoogleCalendarConnector);
registerConnector('google-cloud', GoogleCloudConnector);

// Re-export registry functions
export {
  registerConnector,
  getConnectorMetadata,
  getAllConnectorMetadata,
  getConfigFields,
  getSetupInstructions,
  createConnectorInstance,
  getEnabledConnectors,
  getAllConnectorTools,
} from './registry';

// Re-export types
export type {
  Connector,
  ConnectorConfig,
  ConnectorConfigMap,
  ConnectorMetadata,
  ConfigField,
  ConnectionTestResult,
  ToolResult,
  ToolSet,
  OAuthConfig,
  GitHubConfig,
  JiraConfig,
  AWSConfig,
  ConfluenceConfig,
  JenkinsConfig,
  OutlookConfig,
  GmailConfig,
  YahooConfig,
  GoogleDriveConfig,
  GoogleDocsConfig,
  GoogleSheetsConfig,
  GoogleCalendarConfig,
  GoogleCloudConfig,
} from './types';

// Re-export individual connectors
export { GitHubConnector } from './github';
export { JiraConnector } from './jira';
export { AWSConnector } from './aws';
export { ConfluenceConnector } from './confluence';
export { JenkinsConnector } from './jenkins';
export { OutlookConnector } from './outlook';
export { GmailConnector } from './gmail';
export { YahooConnector } from './yahoo';
export { GoogleDriveConnector } from './google-drive';
export { GoogleDocsConnector } from './google-docs';
export { GoogleSheetsConnector } from './google-sheets';
export { GoogleCalendarConnector } from './google-calendar';
export { GoogleCloudConnector } from './google-cloud';
