import type { GitHubConfig } from '../types';

// GitHub API client
export class GitHubClient {
  private token: string;
  private baseUrl = 'https://api.github.com';
  public defaultOwner?: string;

  constructor(config: GitHubConfig) {
    this.token = config.token;
    this.defaultOwner = config.defaultOwner;
  }

  hasCredentials(): boolean {
    return !!this.token;
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `GitHub API error: ${response.status}`);
    }

    return response.json();
  }

  // Test connection by fetching authenticated user
  async testConnection(): Promise<{ login: string }> {
    return this.request('/user');
  }

  // List pull requests
  async listPullRequests(
    repo: string,
    options?: { state?: 'open' | 'closed' | 'all'; author?: string }
  ): Promise<GitHubPullRequest[]> {
    const params = new URLSearchParams();
    if (options?.state) params.set('state', options.state);
    const query = params.toString() ? `?${params.toString()}` : '';

    let prs: GitHubPullRequest[] = await this.request(`/repos/${repo}/pulls${query}`);

    // Filter by author if specified
    if (options?.author) {
      prs = prs.filter((pr) => pr.user.login === options.author);
    }

    return prs;
  }

  // Get PR details
  async getPullRequest(repo: string, prNumber: number): Promise<GitHubPullRequest> {
    return this.request(`/repos/${repo}/pulls/${prNumber}`);
  }

  // Get PR comments and reviews
  async getPullRequestComments(
    repo: string,
    prNumber: number
  ): Promise<{ comments: GitHubComment[]; reviews: GitHubReview[] }> {
    const [comments, reviews] = await Promise.all([
      this.request<GitHubComment[]>(`/repos/${repo}/issues/${prNumber}/comments`),
      this.request<GitHubReview[]>(`/repos/${repo}/pulls/${prNumber}/reviews`),
    ]);
    return { comments, reviews };
  }

  // List workflow runs
  async listWorkflowRuns(
    repo: string,
    options?: { workflow?: string; status?: string; limit?: number }
  ): Promise<GitHubWorkflowRun[]> {
    const params = new URLSearchParams();
    if (options?.status) params.set('status', options.status);
    if (options?.limit) params.set('per_page', options.limit.toString());
    const query = params.toString() ? `?${params.toString()}` : '';

    let endpoint = `/repos/${repo}/actions/runs${query}`;
    if (options?.workflow) {
      endpoint = `/repos/${repo}/actions/workflows/${options.workflow}/runs${query}`;
    }

    const response: { workflow_runs: GitHubWorkflowRun[] } = await this.request(endpoint);
    return response.workflow_runs;
  }

  // Get workflow run details
  async getWorkflowRun(repo: string, runId: number): Promise<GitHubWorkflowRun> {
    return this.request(`/repos/${repo}/actions/runs/${runId}`);
  }

  // Search issues and PRs
  async searchIssues(query: string): Promise<GitHubSearchResult[]> {
    const response: { items: GitHubSearchResult[] } = await this.request(
      `/search/issues?q=${encodeURIComponent(query)}`
    );
    return response.items;
  }

  // List repositories for the authenticated user or an organization
  async listRepos(options?: {
    type?: 'all' | 'owner' | 'public' | 'private' | 'member';
    sort?: 'created' | 'updated' | 'pushed' | 'full_name';
    org?: string;
    limit?: number;
  }): Promise<GitHubRepository[]> {
    const params = new URLSearchParams();
    if (options?.type) params.set('type', options.type);
    if (options?.sort) params.set('sort', options.sort);
    params.set('per_page', (options?.limit ?? 100).toString());
    const query = params.toString() ? `?${params.toString()}` : '';

    if (options?.org) {
      return this.request(`/orgs/${options.org}/repos${query}`);
    }
    return this.request(`/user/repos${query}`);
  }
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  owner: GitHubUser;
  html_url: string;
  description: string | null;
  fork: boolean;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  homepage: string | null;
  size: number;
  stargazers_count: number;
  watchers_count: number;
  language: string | null;
  forks_count: number;
  open_issues_count: number;
  default_branch: string;
  archived: boolean;
  topics: string[];
}

// GitHub API types
export interface GitHubUser {
  login: string;
  avatar_url: string;
  html_url: string;
}

export interface GitHubPullRequest {
  number: number;
  title: string;
  state: 'open' | 'closed';
  user: GitHubUser;
  html_url: string;
  body: string | null;
  created_at: string;
  updated_at: string;
  merged_at: string | null;
  draft: boolean;
  head: { ref: string };
  base: { ref: string };
  additions: number;
  deletions: number;
  changed_files: number;
  mergeable_state?: string;
  labels: { name: string; color: string }[];
}

export interface GitHubComment {
  id: number;
  user: GitHubUser;
  body: string;
  created_at: string;
  html_url: string;
}

export interface GitHubReview {
  id: number;
  user: GitHubUser;
  body: string;
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'PENDING' | 'DISMISSED';
  submitted_at: string;
  html_url: string;
}

export interface GitHubWorkflowRun {
  id: number;
  name: string;
  head_branch: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | 'timed_out' | null;
  html_url: string;
  created_at: string;
  updated_at: string;
  run_number: number;
  workflow_id: number;
  head_commit: {
    message: string;
    author: { name: string; email: string };
  };
}

export interface GitHubSearchResult {
  number: number;
  title: string;
  state: string;
  user: GitHubUser;
  html_url: string;
  body: string | null;
  created_at: string;
  updated_at: string;
  pull_request?: { url: string };
  labels: { name: string; color: string }[];
}
