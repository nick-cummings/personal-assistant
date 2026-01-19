import type { Connector, GitHubConfig, ConnectionTestResult } from '../types';
import { GitHubClient } from './client';
import { createGitHubTools } from './tools';

export class GitHubConnector implements Connector<'github'> {
  type = 'github' as const;
  name = 'GitHub';

  private client: GitHubClient;

  constructor(config: GitHubConfig) {
    this.client = new GitHubClient(config);
  }

  getTools() {
    return createGitHubTools(this.client);
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const user = await this.client.testConnection();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to connect to GitHub',
      };
    }
  }
}

// Re-export for convenience
export { GitHubClient } from './client';
export { createGitHubTools } from './tools';
