import type { JiraConfig, AtlassianInstance } from '../types';

// Single Jira instance client
export class JiraInstanceClient {
  private auth: string;
  public host: string;
  public name: string;

  constructor(instance: AtlassianInstance) {
    this.name = instance.name;
    // Ensure host doesn't have protocol or trailing slash
    this.host = instance.host.replace(/^https?:\/\//, '').replace(/\/$/, '');
    // Base64 encode email:apiToken for basic auth
    this.auth = Buffer.from(`${instance.email}:${instance.apiToken}`).toString('base64');
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `https://${this.host}/rest/api/3${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Basic ${this.auth}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        error.errorMessages?.[0] || error.message || `Jira API error: ${response.status}`
      );
    }

    return response.json();
  }

  private async agileRequest<T>(endpoint: string): Promise<T> {
    const url = `https://${this.host}/rest/agile/1.0${endpoint}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Basic ${this.auth}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.errorMessages?.[0] || `Jira API error: ${response.status}`);
    }

    return response.json();
  }

  // Test connection by fetching current user
  async testConnection(): Promise<{ displayName: string; emailAddress: string }> {
    return this.request('/myself');
  }

  // Search issues using JQL
  async searchIssues(jql: string, limit = 50): Promise<JiraSearchResult> {
    const params = new URLSearchParams({
      jql,
      maxResults: limit.toString(),
      fields:
        'summary,status,priority,assignee,reporter,created,updated,description,issuetype,labels,project',
    });

    return this.request(`/search/jql?${params.toString()}`);
  }

  // Get issue details
  async getIssue(issueKey: string): Promise<JiraIssue> {
    return this.request(`/issue/${issueKey}`);
  }

  // Get issue comments
  async getIssueComments(issueKey: string): Promise<JiraCommentsResult> {
    return this.request(`/issue/${issueKey}/comment`);
  }

  // List boards
  async listBoards(): Promise<JiraBoardsResult> {
    return this.agileRequest('/board');
  }

  // Get active sprint for a board
  async getActiveSprint(boardId: number): Promise<JiraSprintsResult> {
    return this.agileRequest(`/board/${boardId}/sprint?state=active`);
  }

  // Get sprint issues
  async getSprintIssues(sprintId: number): Promise<JiraSearchResult> {
    return this.searchIssues(`sprint = ${sprintId}`);
  }

  // List all accessible projects
  async listProjects(): Promise<JiraProjectDetail[]> {
    return this.request('/project');
  }
}

// Multi-instance Jira client manager
export class JiraClient {
  private instances: Map<string, JiraInstanceClient> = new Map();
  private instanceList: AtlassianInstance[] = [];

  constructor(config: JiraConfig) {
    // Handle both new multi-instance and legacy single-instance configs
    if (config.instances && config.instances.length > 0) {
      this.instanceList = config.instances;
      for (const instance of config.instances) {
        this.instances.set(instance.name, new JiraInstanceClient(instance));
      }
    } else if (config.host && config.email && config.apiToken) {
      // Legacy single-instance config - convert to instance format
      const legacyInstance: AtlassianInstance = {
        name: 'Default',
        host: config.host,
        email: config.email,
        apiToken: config.apiToken,
      };
      this.instanceList = [legacyInstance];
      this.instances.set('Default', new JiraInstanceClient(legacyInstance));
    }
  }

  hasCredentials(): boolean {
    return this.instances.size > 0;
  }

  // Get list of configured instance names
  getInstanceNames(): string[] {
    return Array.from(this.instances.keys());
  }

  // Get a specific instance by name
  getInstance(name: string): JiraInstanceClient | undefined {
    return this.instances.get(name);
  }

  // Get all instances
  getAllInstances(): JiraInstanceClient[] {
    return Array.from(this.instances.values());
  }

  // Try to infer which instance based on a project key or issue key
  // Project keys are typically 2-10 uppercase letters
  inferInstanceFromKey(key: string): JiraInstanceClient | undefined {
    // For now, return undefined - let the tool query all instances
    // In future, could cache project->instance mappings
    return undefined;
  }

  // Execute a query across all instances (or a specific one)
  async queryAllInstances<T>(
    queryFn: (client: JiraInstanceClient) => Promise<T>,
    instanceName?: string
  ): Promise<{ instance: string; host: string; result: T }[]> {
    const results: { instance: string; host: string; result: T }[] = [];

    if (instanceName) {
      const instance = this.instances.get(instanceName);
      if (instance) {
        const result = await queryFn(instance);
        results.push({ instance: instance.name, host: instance.host, result });
      }
    } else {
      // Query all instances in parallel
      const promises = Array.from(this.instances.entries()).map(async ([name, client]) => {
        try {
          const result = await queryFn(client);
          return { instance: name, host: client.host, result };
        } catch (error) {
          // Log but don't fail - one instance failing shouldn't break others
          console.error(`[Jira] Error querying instance "${name}":`, error);
          return null;
        }
      });

      const settled = await Promise.all(promises);
      for (const r of settled) {
        if (r) results.push(r);
      }
    }

    return results;
  }

  // Legacy methods that work with the first/default instance
  // Keeping for backward compatibility with tests

  get host(): string {
    const first = this.getAllInstances()[0];
    return first?.host || '';
  }

  async testConnection(): Promise<{ displayName: string; emailAddress: string }> {
    const first = this.getAllInstances()[0];
    if (!first) throw new Error('No Jira instances configured');
    return first.testConnection();
  }

  async searchIssues(jql: string, limit = 50): Promise<JiraSearchResult> {
    const first = this.getAllInstances()[0];
    if (!first) throw new Error('No Jira instances configured');
    return first.searchIssues(jql, limit);
  }

  async getIssue(issueKey: string): Promise<JiraIssue> {
    const first = this.getAllInstances()[0];
    if (!first) throw new Error('No Jira instances configured');
    return first.getIssue(issueKey);
  }

  async getIssueComments(issueKey: string): Promise<JiraCommentsResult> {
    const first = this.getAllInstances()[0];
    if (!first) throw new Error('No Jira instances configured');
    return first.getIssueComments(issueKey);
  }

  async listBoards(): Promise<JiraBoardsResult> {
    const first = this.getAllInstances()[0];
    if (!first) throw new Error('No Jira instances configured');
    return first.listBoards();
  }

  async getActiveSprint(boardId: number): Promise<JiraSprintsResult> {
    const first = this.getAllInstances()[0];
    if (!first) throw new Error('No Jira instances configured');
    return first.getActiveSprint(boardId);
  }

  async getSprintIssues(sprintId: number): Promise<JiraSearchResult> {
    const first = this.getAllInstances()[0];
    if (!first) throw new Error('No Jira instances configured');
    return first.getSprintIssues(sprintId);
  }

  async listProjects(): Promise<JiraProjectDetail[]> {
    const first = this.getAllInstances()[0];
    if (!first) throw new Error('No Jira instances configured');
    return first.listProjects();
  }
}

// Jira API types
export interface JiraUser {
  accountId: string;
  displayName: string;
  emailAddress?: string;
  avatarUrls?: Record<string, string>;
}

export interface JiraIssueType {
  id: string;
  name: string;
  iconUrl: string;
}

export interface JiraStatus {
  id: string;
  name: string;
  statusCategory: {
    id: number;
    key: string;
    colorName: string;
    name: string;
  };
}

export interface JiraPriority {
  id: string;
  name: string;
  iconUrl: string;
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
}

export interface JiraProjectDetail {
  id: string;
  key: string;
  name: string;
  projectTypeKey: string;
  avatarUrls?: Record<string, string>;
}

export interface JiraIssueFields {
  summary: string;
  description?: {
    type: string;
    content: Array<{
      type: string;
      content?: Array<{ type: string; text?: string }>;
    }>;
  };
  status: JiraStatus;
  priority: JiraPriority;
  issuetype: JiraIssueType;
  assignee: JiraUser | null;
  reporter: JiraUser;
  project: JiraProject;
  labels: string[];
  created: string;
  updated: string;
}

export interface JiraIssue {
  id: string;
  key: string;
  self: string;
  fields: JiraIssueFields;
}

export interface JiraSearchResult {
  issues: JiraIssue[];
  nextPageToken?: string;
  isLast?: boolean;
  // Legacy fields (deprecated)
  startAt?: number;
  maxResults?: number;
  total?: number;
}

export interface JiraComment {
  id: string;
  author: JiraUser;
  body: {
    type: string;
    content: Array<{
      type: string;
      content?: Array<{ type: string; text?: string }>;
    }>;
  };
  created: string;
  updated: string;
}

export interface JiraCommentsResult {
  startAt: number;
  maxResults: number;
  total: number;
  comments: JiraComment[];
}

export interface JiraBoard {
  id: number;
  name: string;
  type: 'scrum' | 'kanban';
  location?: {
    projectKey: string;
    projectName: string;
  };
}

export interface JiraBoardsResult {
  maxResults: number;
  startAt: number;
  total: number;
  values: JiraBoard[];
}

export interface JiraSprint {
  id: number;
  name: string;
  state: 'active' | 'closed' | 'future';
  startDate?: string;
  endDate?: string;
  goal?: string;
}

export interface JiraSprintsResult {
  maxResults: number;
  startAt: number;
  values: JiraSprint[];
}

// Helper to extract plain text from Jira's ADF (Atlassian Document Format)
export function extractTextFromADF(adf: JiraIssueFields['description']): string {
  if (!adf || !adf.content) return '';

  const extractText = (node: { type: string; content?: Array<{ type: string; text?: string }> }): string => {
    if (node.type === 'text' && 'text' in node) {
      return (node as { text: string }).text || '';
    }
    if (node.content) {
      return node.content.map(extractText).join('');
    }
    return '';
  };

  return adf.content.map(extractText).join('\n');
}
