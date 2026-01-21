import { tool } from 'ai';
import { z } from 'zod';
import { GitHubClient } from './client';
import type { ToolSet } from '../types';

export function createGitHubTools(client: GitHubClient): ToolSet {
  const github_list_prs = tool({
    description:
      'List pull requests for a GitHub repository. Returns PR numbers, titles, authors, status, and links. Use github_get_pr with the PR number to get full details including description and changes.',
    inputSchema: z.object({
      repo: z
        .string()
        .describe(
          'Repository in format "owner/repo" (e.g., "facebook/react", "microsoft/typescript"). If no owner provided, uses default owner from config.'
        ),
      state: z
        .enum(['open', 'closed', 'all'])
        .optional()
        .default('open')
        .describe('Filter by PR state: "open" (default), "closed", or "all"'),
      author: z
        .string()
        .optional()
        .describe('Filter by author GitHub username (e.g., "octocat")'),
    }),
    execute: async ({ repo, state, author }) => {
      console.log('[GitHub] github_list_prs called with:', { repo, state, author });

      if (!client.hasCredentials()) {
        console.log('[GitHub] No credentials configured');
        return {
          error:
            'GitHub not configured. Please add your Personal Access Token in Settings → Connectors.',
        };
      }

      try {
        const fullRepo = repo.includes('/') ? repo : `${client.defaultOwner}/${repo}`;
        console.log('[GitHub] Fetching PRs for:', fullRepo);
        const prs = await client.listPullRequests(fullRepo, { state, author });
        console.log('[GitHub] Found', prs.length, 'pull requests');

        return {
          count: prs.length,
          pullRequests: prs.map((pr) => ({
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
          })),
        };
      } catch (error) {
        console.error('[GitHub] List PRs error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message.includes('401') || message.includes('Unauthorized')) {
          return {
            error:
              'GitHub authentication failed. Please check your Personal Access Token in Settings → Connectors.',
          };
        }
        if (message.includes('404') || message.includes('Not Found')) {
          return {
            error: `Repository "${repo}" not found. Check the repository name and ensure you have access.`,
          };
        }
        return {
          error: `Failed to list pull requests: ${message}`,
        };
      }
    },
  });

  const github_get_pr = tool({
    description:
      'Get detailed information about a specific pull request including full description, file changes, additions/deletions counts, and merge status. Use github_list_prs first to find PR numbers.',
    inputSchema: z.object({
      repo: z
        .string()
        .describe(
          'Repository in format "owner/repo" (e.g., "facebook/react"). Get this from github_list_prs results.'
        ),
      prNumber: z
        .number()
        .describe(
          'Pull request number (e.g., 123, 456). Get this from github_list_prs or github_search_issues results.'
        ),
    }),
    execute: async ({ repo, prNumber }) => {
      console.log('[GitHub] github_get_pr called with:', { repo, prNumber });

      if (!client.hasCredentials()) {
        console.log('[GitHub] No credentials configured');
        return {
          error:
            'GitHub not configured. Please add your Personal Access Token in Settings → Connectors.',
        };
      }

      try {
        const fullRepo = repo.includes('/') ? repo : `${client.defaultOwner}/${repo}`;
        console.log('[GitHub] Fetching PR details for:', fullRepo, '#', prNumber);
        const pr = await client.getPullRequest(fullRepo, prNumber);
        console.log('[GitHub] Got PR:', { number: pr.number, title: pr.title });

        return {
          number: pr.number,
          title: pr.title,
          author: pr.user.login,
          state: pr.state,
          draft: pr.draft,
          url: pr.html_url,
          description: pr.body || '(No description)',
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
      } catch (error) {
        console.error('[GitHub] Get PR error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message.includes('401') || message.includes('Unauthorized')) {
          return {
            error:
              'GitHub authentication failed. Please check your Personal Access Token in Settings → Connectors.',
          };
        }
        if (message.includes('404') || message.includes('Not Found')) {
          return {
            error: `Pull request #${prNumber} not found in "${repo}". It may have been deleted or you may not have access.`,
          };
        }
        return {
          error: `Failed to get pull request: ${message}`,
        };
      }
    },
  });

  const github_get_pr_comments = tool({
    description:
      'Get all comments and code reviews on a pull request. Returns both issue-style comments and code review feedback. Use github_list_prs or github_get_pr first to get the PR number.',
    inputSchema: z.object({
      repo: z
        .string()
        .describe(
          'Repository in format "owner/repo" (e.g., "facebook/react"). Get this from github_list_prs results.'
        ),
      prNumber: z
        .number()
        .describe(
          'Pull request number (e.g., 123). Get this from github_list_prs or github_search_issues results.'
        ),
    }),
    execute: async ({ repo, prNumber }) => {
      console.log('[GitHub] github_get_pr_comments called with:', { repo, prNumber });

      if (!client.hasCredentials()) {
        console.log('[GitHub] No credentials configured');
        return {
          error:
            'GitHub not configured. Please add your Personal Access Token in Settings → Connectors.',
        };
      }

      try {
        const fullRepo = repo.includes('/') ? repo : `${client.defaultOwner}/${repo}`;
        console.log('[GitHub] Fetching PR comments for:', fullRepo, '#', prNumber);
        const { comments, reviews } = await client.getPullRequestComments(fullRepo, prNumber);
        console.log('[GitHub] Found', comments.length, 'comments and', reviews.length, 'reviews');

        return {
          commentCount: comments.length,
          reviewCount: reviews.length,
          comments: comments.map((c) => ({
            author: c.user.login,
            body: c.body,
            createdAt: c.created_at,
            url: c.html_url,
          })),
          reviews: reviews.map((r) => ({
            author: r.user.login,
            state: r.state,
            body: r.body || '(No comment)',
            submittedAt: r.submitted_at,
            url: r.html_url,
          })),
        };
      } catch (error) {
        console.error('[GitHub] Get PR comments error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message.includes('401') || message.includes('Unauthorized')) {
          return {
            error:
              'GitHub authentication failed. Please check your Personal Access Token in Settings → Connectors.',
          };
        }
        if (message.includes('404') || message.includes('Not Found')) {
          return {
            error: `Pull request #${prNumber} not found in "${repo}". It may have been deleted or you may not have access.`,
          };
        }
        return {
          error: `Failed to get pull request comments: ${message}`,
        };
      }
    },
  });

  const github_list_actions_runs = tool({
    description:
      'List GitHub Actions workflow runs for a repository. Shows CI/CD pipeline status, which commits triggered runs, and run outcomes. Use github_get_actions_run with the run ID for more details.',
    inputSchema: z.object({
      repo: z
        .string()
        .describe(
          'Repository in format "owner/repo" (e.g., "facebook/react", "vercel/next.js")'
        ),
      workflow: z
        .string()
        .optional()
        .describe(
          'Filter by workflow file name (e.g., "ci.yml", "tests.yaml", "build.yml"). Omit to see all workflows.'
        ),
      status: z
        .enum(['queued', 'in_progress', 'completed'])
        .optional()
        .describe('Filter by run status: "queued", "in_progress", or "completed"'),
      limit: z
        .number()
        .optional()
        .default(10)
        .describe('Maximum number of runs to return (default: 10, max: 100)'),
    }),
    execute: async ({ repo, workflow, status, limit }) => {
      console.log('[GitHub] github_list_actions_runs called with:', { repo, workflow, status, limit });

      if (!client.hasCredentials()) {
        console.log('[GitHub] No credentials configured');
        return {
          error:
            'GitHub not configured. Please add your Personal Access Token in Settings → Connectors.',
        };
      }

      try {
        const fullRepo = repo.includes('/') ? repo : `${client.defaultOwner}/${repo}`;
        console.log('[GitHub] Fetching workflow runs for:', fullRepo);
        const runs = await client.listWorkflowRuns(fullRepo, { workflow, status, limit });
        console.log('[GitHub] Found', runs.length, 'workflow runs');

        return {
          count: runs.length,
          runs: runs.map((run) => ({
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
          })),
        };
      } catch (error) {
        console.error('[GitHub] List actions runs error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message.includes('401') || message.includes('Unauthorized')) {
          return {
            error:
              'GitHub authentication failed. Please check your Personal Access Token in Settings → Connectors.',
          };
        }
        if (message.includes('404') || message.includes('Not Found')) {
          return {
            error: `Repository "${repo}" not found or GitHub Actions not enabled. Check the repository name.`,
          };
        }
        return {
          error: `Failed to list workflow runs: ${message}`,
        };
      }
    },
  });

  const github_get_actions_run = tool({
    description:
      'Get detailed information about a specific GitHub Actions workflow run. Shows full status, timing, commit details, and result. Use github_list_actions_runs first to get run IDs.',
    inputSchema: z.object({
      repo: z
        .string()
        .describe(
          'Repository in format "owner/repo" (e.g., "facebook/react"). Get this from github_list_actions_runs results.'
        ),
      runId: z
        .number()
        .describe(
          'Workflow run ID (e.g., 1234567890). Get this from github_list_actions_runs results.'
        ),
    }),
    execute: async ({ repo, runId }) => {
      console.log('[GitHub] github_get_actions_run called with:', { repo, runId });

      if (!client.hasCredentials()) {
        console.log('[GitHub] No credentials configured');
        return {
          error:
            'GitHub not configured. Please add your Personal Access Token in Settings → Connectors.',
        };
      }

      try {
        const fullRepo = repo.includes('/') ? repo : `${client.defaultOwner}/${repo}`;
        console.log('[GitHub] Fetching workflow run:', runId);
        const run = await client.getWorkflowRun(fullRepo, runId);
        console.log('[GitHub] Got workflow run:', { id: run.id, name: run.name, conclusion: run.conclusion });

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
      } catch (error) {
        console.error('[GitHub] Get actions run error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message.includes('401') || message.includes('Unauthorized')) {
          return {
            error:
              'GitHub authentication failed. Please check your Personal Access Token in Settings → Connectors.',
          };
        }
        if (message.includes('404') || message.includes('Not Found')) {
          return {
            error: `Workflow run ${runId} not found in "${repo}". It may have been deleted or you may not have access.`,
          };
        }
        return {
          error: `Failed to get workflow run: ${message}`,
        };
      }
    },
  });

  const github_search_issues = tool({
    description:
      'Search GitHub issues and pull requests across repositories using GitHub search syntax. Returns matching items with type (issue or PR), status, and links. Use github_get_pr with the number for PR details.',
    inputSchema: z.object({
      query: z
        .string()
        .describe(
          'GitHub search query. Examples: "is:pr is:open author:octocat" (open PRs by user), "repo:facebook/react is:issue is:open label:bug" (open bugs in repo), "is:pr review:required" (PRs needing review), "is:issue assignee:@me" (issues assigned to you), "is:pr is:merged merged:>2024-01-01" (recently merged PRs)'
        ),
    }),
    execute: async ({ query }) => {
      console.log('[GitHub] github_search_issues called with:', { query });

      if (!client.hasCredentials()) {
        console.log('[GitHub] No credentials configured');
        return {
          error:
            'GitHub not configured. Please add your Personal Access Token in Settings → Connectors.',
        };
      }

      try {
        console.log('[GitHub] Searching issues/PRs with query:', query);
        const results = await client.searchIssues(query);
        console.log('[GitHub] Found', results.length, 'results');

        return {
          count: results.length,
          results: results.map((item) => ({
            number: item.number,
            title: item.title,
            type: item.pull_request ? 'pull_request' : 'issue',
            state: item.state,
            author: item.user.login,
            url: item.html_url,
            labels: item.labels.map((l) => l.name),
            createdAt: item.created_at,
            updatedAt: item.updated_at,
          })),
        };
      } catch (error) {
        console.error('[GitHub] Search issues error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message.includes('401') || message.includes('Unauthorized')) {
          return {
            error:
              'GitHub authentication failed. Please check your Personal Access Token in Settings → Connectors.',
          };
        }
        if (message.includes('422') || message.includes('Validation')) {
          return {
            error: `Invalid search query: ${message}. Check your search syntax.`,
          };
        }
        return {
          error: `Failed to search issues: ${message}`,
        };
      }
    },
  });

  const github_list_repos = tool({
    description:
      'List GitHub repositories for the authenticated user or a specific organization. Returns repo names, descriptions, languages, and activity info. Great for discovering what repositories you have access to.',
    inputSchema: z.object({
      org: z
        .string()
        .optional()
        .describe(
          'Organization name to list repos for (e.g., "facebook", "microsoft"). If omitted, lists repos for the authenticated user.'
        ),
      type: z
        .enum(['all', 'owner', 'public', 'private', 'member'])
        .optional()
        .describe(
          'Filter repos by type: "all" (default), "owner" (repos you own), "public", "private", or "member" (repos you are a member of but don\'t own)'
        ),
      sort: z
        .enum(['created', 'updated', 'pushed', 'full_name'])
        .optional()
        .describe('Sort repos by: "updated" (default), "created", "pushed", or "full_name"'),
      limit: z
        .number()
        .optional()
        .default(30)
        .describe('Maximum number of repos to return (default: 30, max: 100)'),
    }),
    execute: async ({ org, type, sort, limit }) => {
      console.log('[GitHub] github_list_repos called with:', { org, type, sort, limit });

      if (!client.hasCredentials()) {
        console.log('[GitHub] No credentials configured');
        return {
          error:
            'GitHub not configured. Please add your Personal Access Token in Settings → Connectors.',
        };
      }

      try {
        console.log('[GitHub] Listing repos for:', org || '(authenticated user)');
        const repos = await client.listRepos({ org, type, sort, limit });
        console.log('[GitHub] Found', repos.length, 'repositories');

        return {
          count: repos.length,
          owner: org || '(authenticated user)',
          repositories: repos.map((repo) => ({
            name: repo.name,
            fullName: repo.full_name,
            description: repo.description || '(No description)',
            private: repo.private,
            language: repo.language,
            stars: repo.stargazers_count,
            forks: repo.forks_count,
            openIssues: repo.open_issues_count,
            defaultBranch: repo.default_branch,
            archived: repo.archived,
            topics: repo.topics,
            url: repo.html_url,
            createdAt: repo.created_at,
            updatedAt: repo.updated_at,
            pushedAt: repo.pushed_at,
          })),
        };
      } catch (error) {
        console.error('[GitHub] List repos error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message.includes('401') || message.includes('Unauthorized')) {
          return {
            error:
              'GitHub authentication failed. Please check your Personal Access Token in Settings → Connectors.',
          };
        }
        if (message.includes('404') || message.includes('Not Found')) {
          return {
            error: `Organization "${org}" not found or you don't have access to it.`,
          };
        }
        return {
          error: `Failed to list repositories: ${message}`,
        };
      }
    },
  });

  return {
    github_list_prs,
    github_get_pr,
    github_get_pr_comments,
    github_list_actions_runs,
    github_get_actions_run,
    github_search_issues,
    github_list_repos,
  };
}
