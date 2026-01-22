// Main entry point for connectors
// Registers all available connector implementations

import { AWSConnector } from './aws';
import { ConfluenceConnector } from './confluence';
import { GitHubConnector } from './github';
import { GmailConnector } from './gmail';
import { GoogleCalendarConnector } from './google-calendar';
import { GoogleCloudConnector } from './google-cloud';
import { GoogleDocsConnector } from './google-docs';
import { GoogleDriveConnector } from './google-drive';
import { GoogleSheetsConnector } from './google-sheets';
import { JenkinsConnector } from './jenkins';
import { JiraConnector } from './jira';
import { OutlookConnector } from './outlook';
import { registerConnector } from './registry';
import { YahooConnector } from './yahoo';

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
export { AWSConnector } from './aws';
export { ConfluenceConnector } from './confluence';
// Re-export individual connectors
export { GitHubConnector } from './github';
export { GmailConnector } from './gmail';
export { GoogleCalendarConnector } from './google-calendar';
export { GoogleCloudConnector } from './google-cloud';
export { GoogleDocsConnector } from './google-docs';
export { GoogleDriveConnector } from './google-drive';
export { GoogleSheetsConnector } from './google-sheets';
export { JenkinsConnector } from './jenkins';
export { JiraConnector } from './jira';
export { OutlookConnector } from './outlook';
export {
    createConnectorInstance, getAllConnectorMetadata, getAllConnectorTools, getConfigFields, getConnectorMetadata, getEnabledConnectors, getSetupInstructions, registerConnector
} from './registry';
// Re-export types
export type {
    AWSConfig, ConfigField, ConfluenceConfig, ConnectionTestResult, Connector,
    ConnectorConfig,
    ConnectorConfigMap,
    ConnectorMetadata, GitHubConfig, GmailConfig, GoogleCalendarConfig,
    GoogleCloudConfig, GoogleDocsConfig, GoogleDriveConfig, GoogleSheetsConfig, JenkinsConfig, JiraConfig, OAuthConfig, OutlookConfig, ToolResult,
    ToolSet, YahooConfig
} from './types';
export { YahooConnector } from './yahoo';


