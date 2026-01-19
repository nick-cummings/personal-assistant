import { tool } from 'ai';
import { z } from 'zod';
import { GitHubClient } from './client';
import type { ToolSet } from '../types';

export function createGitHubTools(client: GitHubClient): ToolSet {
  const github_list_prs = tool({
    description:
      'List pull requests for a GitHub repository. Returns PR titles, authors, status, and links.',
    inputSchema: z.object({
      repo: z
        .string()
        .describe('Repository in format "owner/repo". If no owner, uses default owner.'),
      state: z
        .enum(['open', 'closed', 'all'])
        .optional()
        .default('open')
        .describe('Filter by PR state'),
      author: z.string().optional().describe('Filter by author username'),
    }),
    execute: async ({ repo, state, author }) => {
      const fullRepo = repo.includes('/') ? repo : `${client.defaultOwner}/${repo}`;
      const prs = await client.listPullRequests(fullRepo, { state, author });

      return prs.map((pr) => ({
        number: pr.number,
        title: pr.title,
        author: pr.user.login,
        state: pr.state,
        draft: pr.draft,
        url: pr.html_url,
        branch: pr.head.ref,
        targetBranch: pr.base.ref,
        labels: pr.labels.map((l) => l.name),
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,
      }));
    },
  });

  const github_get_pr = tool({
    description:
      'Get detailed information about a specific pull request including description, changes, and merge status.',
    inputSchema: z.object({
      repo: z.string().describe('Repository in format "owner/repo"'),
      prNumber: z.number().describe('Pull request number'),
    }),
    execute: async ({ repo, prNumber }) => {
      const fullRepo = repo.includes('/') ? repo : `${client.defaultOwner}/${repo}`;
      const pr = await client.getPullRequest(fullRepo, prNumber);

      return {
        number: pr.number,
        title: pr.title,
        author: pr.user.login,
        state: pr.state,
        draft: pr.draft,
        url: pr.html_url,
        description: pr.body,
        branch: pr.head.ref,
        targetBranch: pr.base.ref,
        additions: pr.additions,
        deletions: pr.deletions,
        changedFiles: pr.changed_files,
        mergeableState: pr.mergeable_state,
        labels: pr.labels.map((l) => l.name),
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,
        mergedAt: pr.merged_at,
      };
    },
  });

  const github_get_pr_comments = tool({
    description: 'Get comments and reviews on a pull request.',
    inputSchema: z.object({
      repo: z.string().describe('Repository in format "owner/repo"'),
      prNumber: z.number().describe('Pull request number'),
    }),
    execute: async ({ repo, prNumber }) => {
      const fullRepo = repo.includes('/') ? repo : `${client.defaultOwner}/${repo}`;
      const { comments, reviews } = await client.getPullRequestComments(fullRepo, prNumber);

      return {
        comments: comments.map((c) => ({
          author: c.user.login,
          body: c.body,
          createdAt: c.created_at,
          url: c.html_url,
        })),
        reviews: reviews.map((r) => ({
          author: r.user.login,
          state: r.state,
          body: r.body,
          submittedAt: r.submitted_at,
          url: r.html_url,
        })),
      };
    },
  });

  const github_list_actions_runs = tool({
    description: 'List GitHub Actions workflow runs for a repository.',
    inputSchema: z.object({
      repo: z.string().describe('Repository in format "owner/repo"'),
      workflow: z.string().optional().describe('Filter by workflow file name (e.g., "ci.yml")'),
      status: z
        .enum(['queued', 'in_progress', 'completed'])
        .optional()
        .describe('Filter by run status'),
      limit: z.number().optional().default(10).describe('Maximum number of runs to return'),
    }),
    execute: async ({ repo, workflow, status, limit }) => {
      const fullRepo = repo.includes('/') ? repo : `${client.defaultOwner}/${repo}`;
      const runs = await client.listWorkflowRuns(fullRepo, { workflow, status, limit });

      return runs.map((run) => ({
        id: run.id,
        name: run.name,
        runNumber: run.run_number,
        branch: run.head_branch,
        status: run.status,
        conclusion: run.conclusion,
        url: run.html_url,
        commitMessage: run.head_commit.message,
        commitAuthor: run.head_commit.author.name,
        createdAt: run.created_at,
      }));
    },
  });

  const github_get_actions_run = tool({
    description: 'Get details about a specific GitHub Actions workflow run.',
    inputSchema: z.object({
      repo: z.string().describe('Repository in format "owner/repo"'),
      runId: z.number().describe('Workflow run ID'),
    }),
    execute: async ({ repo, runId }) => {
      const fullRepo = repo.includes('/') ? repo : `${client.defaultOwner}/${repo}`;
      const run = await client.getWorkflowRun(fullRepo, runId);

      return {
        id: run.id,
        name: run.name,
        runNumber: run.run_number,
        branch: run.head_branch,
        status: run.status,
        conclusion: run.conclusion,
        url: run.html_url,
        commitMessage: run.head_commit.message,
        commitAuthor: run.head_commit.author.name,
        createdAt: run.created_at,
        updatedAt: run.updated_at,
      };
    },
  });

  const github_search_issues = tool({
    description:
      'Search GitHub issues and pull requests using GitHub search syntax. Returns matching issues/PRs.',
    inputSchema: z.object({
      query: z
        .string()
        .describe(
          'GitHub search query (e.g., "is:pr is:open author:username", "repo:owner/repo label:bug")'
        ),
    }),
    execute: async ({ query }) => {
      const results = await client.searchIssues(query);

      return results.map((item) => ({
        number: item.number,
        title: item.title,
        type: item.pull_request ? 'pull_request' : 'issue',
        state: item.state,
        author: item.user.login,
        url: item.html_url,
        labels: item.labels.map((l) => l.name),
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      }));
    },
  });

  return {
    github_list_prs,
    github_get_pr,
    github_get_pr_comments,
    github_list_actions_runs,
    github_get_actions_run,
    github_search_issues,
  };
}
