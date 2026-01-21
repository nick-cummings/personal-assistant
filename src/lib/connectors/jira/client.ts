import type { JiraConfig } from '../types';

// Jira API client
export class JiraClient {
  private config: JiraConfig;
  private auth: string;
  public host: string;

  constructor(config: JiraConfig) {
    this.config = config;
    // Ensure host doesn't have protocol or trailing slash
    this.host = config.host.replace(/^https?:\/\//, '').replace(/\/$/, '');
    // Base64 encode email:apiToken for basic auth
    this.auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');
  }

  hasCredentials(): boolean {
    return !!(this.config.host && this.config.email && this.config.apiToken);
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

  // Test connection by fetching current user
  async testConnection(): Promise<{ displayName: string; emailAddress: string }> {
    return this.request('/myself');
  }

  // Search issues using JQL (uses new /search/jql endpoint)
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
    const url = `https://${this.host}/rest/agile/1.0/board`;
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

  // Get active sprint for a board
  async getActiveSprint(boardId: number): Promise<JiraSprintsResult> {
    const url = `https://${this.host}/rest/agile/1.0/board/${boardId}/sprint?state=active`;
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

  // Get sprint issues
  async getSprintIssues(sprintId: number): Promise<JiraSearchResult> {
    return this.searchIssues(`sprint = ${sprintId}`);
  }

  // List all accessible projects
  async listProjects(): Promise<JiraProjectDetail[]> {
    return this.request('/project');
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
