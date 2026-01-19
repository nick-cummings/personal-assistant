import type { Connector, JiraConfig, ConnectionTestResult } from '../types';
import { JiraClient } from './client';
import { createJiraTools } from './tools';

export class JiraConnector implements Connector<'jira'> {
  type = 'jira' as const;
  name = 'Jira';

  private client: JiraClient;
  private host: string;

  constructor(config: JiraConfig) {
    this.client = new JiraClient(config);
    this.host = config.host.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }

  getTools() {
    return createJiraTools(this.client, this.host);
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const user = await this.client.testConnection();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to connect to Jira',
      };
    }
  }
}

// Re-export for convenience
export { JiraClient } from './client';
export { createJiraTools } from './tools';
