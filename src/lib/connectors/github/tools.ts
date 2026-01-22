import { tool } from 'ai';
import { z } from 'zod';
import type { ToolSet } from '../types';
import { GitHubClient } from './client';

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
      author: z.string().optional().describe('Filter by author GitHub username (e.g., "octocat")'),
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
        .describe('Repository in format "owner/repo" (e.g., "facebook/react", "vercel/next.js")'),
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
      console.log('[GitHub] github_list_actions_runs called with:', {
        repo,
        workflow,
        status,
        limit,
      });

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
        console.log('[GitHub] Got workflow run:', {
          id: run.id,
          name: run.name,
          conclusion: run.conclusion,
        });

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
      'List GitHub repositories for the authenticated user or a specific organization. Returns repo names with full "owner/repo" format, descriptions, languages, and activity info. IMPORTANT: Always use this tool FIRST when the user mentions a repository by name only (e.g., "writers-platform") to find the correct full repository name from the user\'s own repos before using other tools like github_get_repo_tree or github_search_code.',
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

  const github_get_repo_tree = tool({
    description:
      'Get the directory tree (file and folder structure) of a GitHub repository. Returns file paths, types, and sizes. Use this to understand a repository\'s structure before reading specific files. CRITICAL: You MUST use github_list_repos FIRST when the user mentions a repo by name only to get the correct "owner/repo" from their own repos - do NOT guess or search.',
    inputSchema: z.object({
      repo: z
        .string()
        .describe(
          'Repository in format "owner/repo" (e.g., "facebook/react"). You MUST get this from github_list_repos results first - never guess the owner.'
        ),
      branch: z
        .string()
        .optional()
        .describe(
          'Branch name to get the tree from (e.g., "main", "develop"). Defaults to the default branch.'
        ),
      recursive: z
        .boolean()
        .optional()
        .default(true)
        .describe(
          'If true (default), returns all files in all subdirectories. If false, only returns top-level items.'
        ),
      maxFiles: z
        .number()
        .optional()
        .default(100)
        .describe(
          'Maximum number of files to return (default: 100). Use smaller values to avoid token limits. Set to 0 for unlimited.'
        ),
    }),
    execute: async ({ repo, branch, recursive, maxFiles }) => {
      console.log('[GitHub] github_get_repo_tree called with:', { repo, branch, recursive, maxFiles });

      if (!client.hasCredentials()) {
        console.log('[GitHub] No credentials configured');
        return {
          error:
            'GitHub not configured. Please add your Personal Access Token in Settings → Connectors.',
        };
      }

      try {
        const fullRepo = repo.includes('/') ? repo : `${client.defaultOwner}/${repo}`;
        console.log('[GitHub] Fetching repo tree for:', fullRepo);
        const tree = await client.getRepoTree(fullRepo, { branch, recursive });
        console.log('[GitHub] Found', tree.tree.length, 'items in tree');

        // Organize into a more useful structure
        const allFiles = tree.tree.filter((item) => item.type === 'blob');
        const directories = tree.tree.filter((item) => item.type === 'tree');

        // Apply maxFiles limit
        const limit = maxFiles || 0;
        const files = limit > 0 ? allFiles.slice(0, limit) : allFiles;
        const filesLimited = limit > 0 && allFiles.length > limit;

        return {
          repository: fullRepo,
          branch: branch || '(default)',
          truncated: tree.truncated || filesLimited,
          totalItems: tree.tree.length,
          fileCount: allFiles.length,
          filesReturned: files.length,
          directoryCount: directories.length,
          files: files.map((f) => ({
            path: f.path,
            size: f.size,
          })),
          directories: directories.map((d) => d.path),
          note: filesLimited
            ? `Showing first ${limit} of ${allFiles.length} files. Use maxFiles parameter to see more.`
            : undefined,
        };
      } catch (error) {
        console.error('[GitHub] Get repo tree error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message.includes('401') || message.includes('Unauthorized')) {
          return {
            error:
              'GitHub authentication failed. Please check your Personal Access Token in Settings → Connectors.',
          };
        }
        if (message.includes('404') || message.includes('Not Found')) {
          return {
            error: `Repository "${repo}" not found or you don't have access to it.`,
          };
        }
        return {
          error: `Failed to get repository tree: ${message}`,
        };
      }
    },
  });

  const github_get_file_content = tool({
    description:
      'Read the contents of a specific file from a GitHub repository. Returns the decoded file content. Use github_get_repo_tree first to find file paths. Best for reading README, config files, and source code. Large files are automatically truncated. CRITICAL: You MUST use github_list_repos FIRST when the user mentions a repo by name only to get the correct "owner/repo" - never guess the owner.',
    inputSchema: z.object({
      repo: z
        .string()
        .describe(
          'Repository in format "owner/repo" (e.g., "facebook/react"). Get this from github_list_repos or github_get_repo_tree results.'
        ),
      path: z
        .string()
        .describe(
          'Path to the file within the repository (e.g., "README.md", "package.json", "src/index.ts"). Get this from github_get_repo_tree results.'
        ),
      ref: z
        .string()
        .optional()
        .describe(
          'Branch name, tag, or commit SHA to read from (e.g., "main", "v1.0.0", "abc123"). Defaults to the default branch.'
        ),
      maxBytes: z
        .number()
        .optional()
        .default(15000)
        .describe(
          'Maximum bytes of content to return (default: 15000, ~15KB). Use smaller values when reading multiple files. Set to 0 for no limit (use with caution).'
        ),
    }),
    execute: async ({ repo, path, ref, maxBytes }) => {
      console.log('[GitHub] github_get_file_content called with:', { repo, path, ref, maxBytes });

      if (!client.hasCredentials()) {
        console.log('[GitHub] No credentials configured');
        return {
          error:
            'GitHub not configured. Please add your Personal Access Token in Settings → Connectors.',
        };
      }

      try {
        const fullRepo = repo.includes('/') ? repo : `${client.defaultOwner}/${repo}`;
        console.log('[GitHub] Fetching file content for:', fullRepo, path);
        const file = await client.getFileContent(fullRepo, path, ref);
        console.log('[GitHub] Got file:', { name: file.name, size: file.size });

        // Decode base64 content
        let content = '(Unable to decode content)';
        let truncated = false;
        if (file.content && file.encoding === 'base64') {
          content = Buffer.from(file.content, 'base64').toString('utf-8');

          // Truncate if needed
          const limit = maxBytes || 0;
          if (limit > 0 && content.length > limit) {
            content = content.slice(0, limit);
            truncated = true;
          }
        }

        return {
          name: file.name,
          path: file.path,
          size: file.size,
          url: file.html_url,
          truncated,
          truncatedAt: truncated ? maxBytes : undefined,
          content,
        };
      } catch (error) {
        console.error('[GitHub] Get file content error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message.includes('401') || message.includes('Unauthorized')) {
          return {
            error:
              'GitHub authentication failed. Please check your Personal Access Token in Settings → Connectors.',
          };
        }
        if (message.includes('404') || message.includes('Not Found')) {
          return {
            error: `File "${path}" not found in "${repo}". Check the path and ensure you have access.`,
          };
        }
        if (message.includes('too large')) {
          return {
            error: `File "${path}" is too large to fetch via the API. Try using the raw download URL instead.`,
          };
        }
        return {
          error: `Failed to get file content: ${message}`,
        };
      }
    },
  });

  const github_get_repo_languages = tool({
    description:
      'Get the programming language breakdown for a GitHub repository. Returns languages with their byte counts and percentages. Useful for understanding the tech stack. CRITICAL: You MUST use github_list_repos FIRST when the user mentions a repo by name only to get the correct "owner/repo" - never guess the owner.',
    inputSchema: z.object({
      repo: z
        .string()
        .describe(
          'Repository in format "owner/repo" (e.g., "facebook/react", "microsoft/typescript"). Get this from github_list_repos results.'
        ),
    }),
    execute: async ({ repo }) => {
      console.log('[GitHub] github_get_repo_languages called with:', { repo });

      if (!client.hasCredentials()) {
        console.log('[GitHub] No credentials configured');
        return {
          error:
            'GitHub not configured. Please add your Personal Access Token in Settings → Connectors.',
        };
      }

      try {
        const fullRepo = repo.includes('/') ? repo : `${client.defaultOwner}/${repo}`;
        console.log('[GitHub] Fetching languages for:', fullRepo);
        const languages = await client.getRepoLanguages(fullRepo);
        console.log('[GitHub] Found languages:', Object.keys(languages));

        // Calculate percentages
        const totalBytes = Object.values(languages).reduce((sum, bytes) => sum + bytes, 0);
        const languagesWithPercentages = Object.entries(languages).map(([language, bytes]) => ({
          language,
          bytes,
          percentage: totalBytes > 0 ? Math.round((bytes / totalBytes) * 1000) / 10 : 0,
        }));

        // Sort by bytes descending
        languagesWithPercentages.sort((a, b) => b.bytes - a.bytes);

        return {
          repository: fullRepo,
          totalBytes,
          languageCount: languagesWithPercentages.length,
          languages: languagesWithPercentages,
        };
      } catch (error) {
        console.error('[GitHub] Get repo languages error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message.includes('401') || message.includes('Unauthorized')) {
          return {
            error:
              'GitHub authentication failed. Please check your Personal Access Token in Settings → Connectors.',
          };
        }
        if (message.includes('404') || message.includes('Not Found')) {
          return {
            error: `Repository "${repo}" not found or you don't have access to it.`,
          };
        }
        return {
          error: `Failed to get repository languages: ${message}`,
        };
      }
    },
  });

  const github_search_code = tool({
    description:
      'Search for code patterns within repositories. WARNING: This searches ALL of GitHub by default which may return repos from other users. CRITICAL: When the user mentions a specific repo by name, you MUST first use github_list_repos to get the correct "owner/repo" from their own repos, then pass that to the repo parameter. Never use this tool without the repo parameter when the user is asking about their own repository.',
    inputSchema: z.object({
      query: z
        .string()
        .describe(
          'Search query for code content. Examples: "useState" (find React hooks), "class UserService" (find class definitions), "import express" (find Express usage), "TODO" (find todo comments), "function authenticate" (find auth functions)'
        ),
      repo: z
        .string()
        .optional()
        .describe(
          'Limit search to a specific repository in format "owner/repo" (e.g., "facebook/react"). Omit to search across all accessible repositories.'
        ),
      language: z
        .string()
        .optional()
        .describe(
          'Filter by programming language (e.g., "typescript", "python", "javascript", "go", "rust")'
        ),
      limit: z
        .number()
        .optional()
        .default(20)
        .describe('Maximum number of results to return (default: 20, max: 100)'),
    }),
    execute: async ({ query, repo, language, limit }) => {
      console.log('[GitHub] github_search_code called with:', { query, repo, language, limit });

      if (!client.hasCredentials()) {
        console.log('[GitHub] No credentials configured');
        return {
          error:
            'GitHub not configured. Please add your Personal Access Token in Settings → Connectors.',
        };
      }

      try {
        const fullRepo = repo && !repo.includes('/') ? `${client.defaultOwner}/${repo}` : repo;
        console.log('[GitHub] Searching code with query:', query);
        const results = await client.searchCode(query, { repo: fullRepo, language, limit });
        console.log('[GitHub] Found', results.length, 'code matches');

        return {
          query,
          filters: {
            repo: fullRepo || '(all repositories)',
            language: language || '(all languages)',
          },
          count: results.length,
          results: results.map((result) => ({
            repository: result.repository.full_name,
            file: result.name,
            path: result.path,
            url: result.html_url,
            matches: result.text_matches?.map((match) => ({
              fragment: match.fragment,
            })),
          })),
        };
      } catch (error) {
        console.error('[GitHub] Search code error:', error);
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
          error: `Failed to search code: ${message}`,
        };
      }
    },
  });

  const github_list_orgs = tool({
    description:
      'List GitHub organizations that the authenticated user belongs to. Returns organization names, descriptions, and URLs. Use the organization name with github_list_repos to see repositories in that organization.',
    inputSchema: z.object({}),
    execute: async () => {
      console.log('[GitHub] github_list_orgs called');

      if (!client.hasCredentials()) {
        console.log('[GitHub] No credentials configured');
        return {
          error:
            'GitHub not configured. Please add your Personal Access Token in Settings → Connectors.',
        };
      }

      try {
        console.log('[GitHub] Fetching organizations for authenticated user');
        const orgs = await client.listOrganizations();
        console.log('[GitHub] Found', orgs.length, 'organizations');

        return {
          count: orgs.length,
          organizations: orgs.map((org) => ({
            name: org.login,
            description: org.description || '(No description)',
            avatarUrl: org.avatar_url,
            url: `https://github.com/${org.login}`,
          })),
        };
      } catch (error) {
        console.error('[GitHub] List orgs error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message.includes('401') || message.includes('Unauthorized')) {
          return {
            error:
              'GitHub authentication failed. Please check your Personal Access Token in Settings → Connectors.',
          };
        }
        return {
          error: `Failed to list organizations: ${message}`,
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
    github_list_orgs,
    github_list_repos,
    github_get_repo_tree,
    github_get_file_content,
    github_get_repo_languages,
    github_search_code,
  };
}
