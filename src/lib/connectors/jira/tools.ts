import { tool } from 'ai';
import { z } from 'zod';
import { JiraClient, JiraInstanceClient, extractTextFromADF, type JiraSearchResult } from './client';
import type { ToolSet } from '../types';

// Helper to get instance names for schema description
function getInstanceDescription(client: JiraClient): string {
  const names = client.getInstanceNames();
  if (names.length === 0) return 'Instance name (no instances configured)';
  if (names.length === 1) return `Instance name. Available: "${names[0]}"`;
  return `Instance name. Available: ${names.map((n) => `"${n}"`).join(', ')}. Leave empty to query all instances.`;
}

export function createJiraTools(client: JiraClient): ToolSet {
  const jira_search_issues = tool({
    description:
      'Search Jira issues using JQL (Jira Query Language). Returns issue keys (like "PROJ-123"), summaries, status, priority, and assignees. Use jira_get_issue with the issue key to get full details including description. When multiple Jira instances are configured, queries all instances by default unless a specific instance is specified.',
    inputSchema: z.object({
      jql: z
        .string()
        .describe(
          'JQL query string. Examples: "assignee = currentUser() AND status != Done" (my open issues), "project = PROJ AND sprint in openSprints()" (current sprint), "status = \\"In Progress\\"" (issues in progress), "labels = bug AND priority = High" (high priority bugs), "created >= -7d" (created in last 7 days)'
        ),
      limit: z
        .number()
        .optional()
        .default(20)
        .describe('Maximum number of results to return per instance (default: 20)'),
      instance: z
        .string()
        .optional()
        .describe(getInstanceDescription(client)),
    }),
    execute: async ({ jql, limit, instance }) => {
      console.log('[Jira] jira_search_issues called with:', { jql, limit, instance });

      if (!client.hasCredentials()) {
        console.log('[Jira] No credentials configured');
        return {
          error:
            'Jira not configured. Please add your host, email, and API token in Settings → Connectors.',
        };
      }

      try {
        console.log('[Jira] Querying instances...');
        const results = await client.queryAllInstances(
          (instanceClient) => instanceClient.searchIssues(jql, limit),
          instance
        );

        if (results.length === 0) {
          return {
            error: instance
              ? `Instance "${instance}" not found. Available instances: ${client.getInstanceNames().join(', ')}`
              : 'No Jira instances configured.',
          };
        }

        // Flatten results from all instances
        const allIssues: Array<{
          instance: string;
          host: string;
          key: string;
          summary: string;
          type?: string;
          status?: string;
          statusCategory?: string;
          priority?: string;
          assignee?: string;
          reporter?: string;
          labels: string[];
          project?: string;
          url: string;
          created: string;
          updated: string;
        }> = [];

        for (const { instance: instName, host, result } of results) {
          for (const issue of result.issues) {
            allIssues.push({
              instance: instName,
              host,
              key: issue.key,
              summary: issue.fields.summary,
              type: issue.fields.issuetype?.name,
              status: issue.fields.status?.name,
              statusCategory: issue.fields.status?.statusCategory?.name,
              priority: issue.fields.priority?.name,
              assignee: issue.fields.assignee?.displayName,
              reporter: issue.fields.reporter?.displayName,
              labels: issue.fields.labels,
              project: issue.fields.project?.key,
              url: `https://${host}/browse/${issue.key}`,
              created: issue.fields.created,
              updated: issue.fields.updated,
            });
          }
        }

        console.log('[Jira] Search returned', allIssues.length, 'issues across', results.length, 'instances');

        return {
          instancesQueried: results.map((r) => r.instance),
          count: allIssues.length,
          issues: allIssues,
        };
      } catch (error) {
        console.error('[Jira] Search error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message.includes('401') || message.includes('Unauthorized')) {
          return {
            error:
              'Jira authentication failed. Please check your email and API token in Settings → Connectors.',
          };
        }
        if (message.includes('400') || message.includes('parse')) {
          return {
            error: `Invalid JQL query: ${message}. Check your JQL syntax.`,
          };
        }
        return {
          error: `Failed to search Jira issues: ${message}`,
        };
      }
    },
  });

  const jira_get_issue = tool({
    description:
      'Get detailed information about a specific Jira issue by its key. Returns the full description, comments count, status, priority, assignee, and other details. Use jira_search_issues first to find issue keys. When multiple Jira instances are configured and no instance is specified, searches all instances for the issue.',
    inputSchema: z.object({
      issueKey: z
        .string()
        .describe(
          'The issue key in the format "PROJECT-NUMBER" (e.g., "PROJ-123", "DEV-456", "BUG-789"). Get this from jira_search_issues results.'
        ),
      instance: z
        .string()
        .optional()
        .describe(getInstanceDescription(client)),
    }),
    execute: async ({ issueKey, instance }) => {
      console.log('[Jira] jira_get_issue called with:', { issueKey, instance });

      if (!client.hasCredentials()) {
        console.log('[Jira] No credentials configured');
        return {
          error:
            'Jira not configured. Please add your host, email, and API token in Settings → Connectors.',
        };
      }

      // Validate issue key format
      if (!/^[A-Z]+-\d+$/i.test(issueKey)) {
        console.log('[Jira] Invalid issue key format:', issueKey);
        return {
          error: `Invalid issue key format "${issueKey}". Issue keys should be in the format "PROJECT-NUMBER" (e.g., "PROJ-123").`,
        };
      }

      try {
        console.log('[Jira] Querying instances for issue...');
        const results = await client.queryAllInstances(
          async (instanceClient) => {
            try {
              return await instanceClient.getIssue(issueKey);
            } catch (e) {
              // Issue not found in this instance - return null
              const msg = e instanceof Error ? e.message : '';
              if (msg.includes('404') || msg.includes('does not exist')) {
                return null;
              }
              throw e; // Re-throw other errors
            }
          },
          instance
        );

        // Find the first instance that has this issue
        const found = results.find((r) => r.result !== null);

        if (!found || !found.result) {
          if (instance) {
            return {
              error: `Issue "${issueKey}" was not found in instance "${instance}". It may have been deleted or you may not have permission to view it.`,
            };
          }
          return {
            error: `Issue "${issueKey}" was not found in any configured Jira instance. It may have been deleted or you may not have permission to view it.`,
          };
        }

        const issue = found.result;
        console.log('[Jira] Got issue from instance:', found.instance, {
          key: issue.key,
          summary: issue.fields.summary,
        });

        return {
          instance: found.instance,
          host: found.host,
          key: issue.key,
          summary: issue.fields.summary,
          description: extractTextFromADF(issue.fields.description),
          type: issue.fields.issuetype.name,
          status: issue.fields.status.name,
          statusCategory: issue.fields.status.statusCategory.name,
          priority: issue.fields.priority?.name,
          assignee: issue.fields.assignee?.displayName,
          reporter: issue.fields.reporter?.displayName,
          labels: issue.fields.labels,
          project: {
            key: issue.fields.project.key,
            name: issue.fields.project.name,
          },
          url: `https://${found.host}/browse/${issue.key}`,
          created: issue.fields.created,
          updated: issue.fields.updated,
        };
      } catch (error) {
        console.error('[Jira] Get issue error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message.includes('401') || message.includes('Unauthorized')) {
          return {
            error:
              'Jira authentication failed. Please check your email and API token in Settings → Connectors.',
          };
        }
        if (message.includes('404') || message.includes('does not exist')) {
          return {
            error: `Issue "${issueKey}" was not found. It may have been deleted or you may not have permission to view it.`,
          };
        }
        return {
          error: `Failed to get Jira issue: ${message}`,
        };
      }
    },
  });

  const jira_get_issue_comments = tool({
    description:
      'Get all comments on a specific Jira issue. Returns the comment authors, content, and timestamps. Use jira_search_issues or jira_get_issue first to get the issue key. When multiple Jira instances are configured and no instance is specified, searches all instances for the issue.',
    inputSchema: z.object({
      issueKey: z
        .string()
        .describe(
          'The issue key in the format "PROJECT-NUMBER" (e.g., "PROJ-123"). Get this from jira_search_issues results.'
        ),
      instance: z
        .string()
        .optional()
        .describe(getInstanceDescription(client)),
    }),
    execute: async ({ issueKey, instance }) => {
      console.log('[Jira] jira_get_issue_comments called with:', { issueKey, instance });

      if (!client.hasCredentials()) {
        console.log('[Jira] No credentials configured');
        return {
          error:
            'Jira not configured. Please add your host, email, and API token in Settings → Connectors.',
        };
      }

      // Validate issue key format
      if (!/^[A-Z]+-\d+$/i.test(issueKey)) {
        console.log('[Jira] Invalid issue key format:', issueKey);
        return {
          error: `Invalid issue key format "${issueKey}". Issue keys should be in the format "PROJECT-NUMBER" (e.g., "PROJ-123").`,
        };
      }

      try {
        console.log('[Jira] Querying instances for issue comments...');
        const results = await client.queryAllInstances(
          async (instanceClient) => {
            try {
              return await instanceClient.getIssueComments(issueKey);
            } catch (e) {
              // Issue not found in this instance - return null
              const msg = e instanceof Error ? e.message : '';
              if (msg.includes('404') || msg.includes('does not exist')) {
                return null;
              }
              throw e;
            }
          },
          instance
        );

        // Find the first instance that has this issue
        const found = results.find((r) => r.result !== null);

        if (!found || !found.result) {
          if (instance) {
            return {
              error: `Issue "${issueKey}" was not found in instance "${instance}". It may have been deleted or you may not have permission to view it.`,
            };
          }
          return {
            error: `Issue "${issueKey}" was not found in any configured Jira instance. It may have been deleted or you may not have permission to view it.`,
          };
        }

        const result = found.result;
        console.log('[Jira] Found', result.total, 'comments from instance:', found.instance);

        return {
          instance: found.instance,
          host: found.host,
          total: result.total,
          comments: result.comments.map((comment) => ({
            author: comment.author.displayName,
            body: extractTextFromADF(comment.body as unknown as typeof comment.body),
            created: comment.created,
            updated: comment.updated,
          })),
        };
      } catch (error) {
        console.error('[Jira] Get comments error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message.includes('401') || message.includes('Unauthorized')) {
          return {
            error:
              'Jira authentication failed. Please check your email and API token in Settings → Connectors.',
          };
        }
        if (message.includes('404') || message.includes('does not exist')) {
          return {
            error: `Issue "${issueKey}" was not found. It may have been deleted or you may not have permission to view it.`,
          };
        }
        return {
          error: `Failed to get issue comments: ${message}`,
        };
      }
    },
  });

  const jira_list_boards = tool({
    description:
      'List all available Jira boards (Scrum and Kanban boards). Returns board IDs, names, types, and associated projects. Use the board ID with jira_get_sprint to get active sprint information. When multiple Jira instances are configured, queries all instances by default.',
    inputSchema: z.object({
      instance: z
        .string()
        .optional()
        .describe(getInstanceDescription(client)),
    }),
    execute: async ({ instance }) => {
      console.log('[Jira] jira_list_boards called with:', { instance });

      if (!client.hasCredentials()) {
        console.log('[Jira] No credentials configured');
        return {
          error:
            'Jira not configured. Please add your host, email, and API token in Settings → Connectors.',
        };
      }

      try {
        console.log('[Jira] Querying instances for boards...');
        const results = await client.queryAllInstances(
          (instanceClient) => instanceClient.listBoards(),
          instance
        );

        if (results.length === 0) {
          return {
            error: instance
              ? `Instance "${instance}" not found. Available instances: ${client.getInstanceNames().join(', ')}`
              : 'No Jira instances configured.',
          };
        }

        // Flatten results from all instances
        const allBoards: Array<{
          instance: string;
          host: string;
          id: number;
          name: string;
          type: string;
          projectKey?: string;
          projectName?: string;
        }> = [];

        for (const { instance: instName, host, result } of results) {
          for (const board of result.values) {
            allBoards.push({
              instance: instName,
              host,
              id: board.id,
              name: board.name,
              type: board.type,
              projectKey: board.location?.projectKey,
              projectName: board.location?.projectName,
            });
          }
        }

        console.log('[Jira] Found', allBoards.length, 'boards across', results.length, 'instances');

        return {
          instancesQueried: results.map((r) => r.instance),
          total: allBoards.length,
          boards: allBoards,
        };
      } catch (error) {
        console.error('[Jira] List boards error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message.includes('401') || message.includes('Unauthorized')) {
          return {
            error:
              'Jira authentication failed. Please check your email and API token in Settings → Connectors.',
          };
        }
        return {
          error: `Failed to list Jira boards: ${message}`,
        };
      }
    },
  });

  const jira_get_sprint = tool({
    description:
      'Get the active sprint for a specific board, including all sprint issues grouped by status. Use jira_list_boards first to get board IDs. Only works for Scrum boards (not Kanban). IMPORTANT: When multiple Jira instances are configured, you MUST specify the instance name since board IDs are instance-specific.',
    inputSchema: z.object({
      boardId: z
        .number()
        .describe(
          'The numeric board ID as returned by jira_list_boards (e.g., 1, 42, 123). Only Scrum boards have sprints.'
        ),
      instance: z
        .string()
        .optional()
        .describe(getInstanceDescription(client) + ' IMPORTANT: Board IDs are instance-specific, so specify the instance from jira_list_boards results.'),
    }),
    execute: async ({ boardId, instance }) => {
      console.log('[Jira] jira_get_sprint called with:', { boardId, instance });

      if (!client.hasCredentials()) {
        console.log('[Jira] No credentials configured');
        return {
          error:
            'Jira not configured. Please add your host, email, and API token in Settings → Connectors.',
        };
      }

      // For sprint operations, we should use a specific instance since board IDs are instance-specific
      // If multiple instances and no instance specified, warn the user
      const instanceNames = client.getInstanceNames();
      if (!instance && instanceNames.length > 1) {
        return {
          error: `Multiple Jira instances are configured. Please specify which instance this board belongs to using the "instance" parameter. Available instances: ${instanceNames.join(', ')}`,
        };
      }

      try {
        console.log('[Jira] Querying instance for sprint...');
        const results = await client.queryAllInstances(
          async (instanceClient) => {
            const sprintsResult = await instanceClient.getActiveSprint(boardId);
            if (!sprintsResult.values || sprintsResult.values.length === 0) {
              return null;
            }
            const activeSprint = sprintsResult.values[0];
            const issues = await instanceClient.searchIssues(`sprint = ${activeSprint.id}`);
            return { sprint: activeSprint, issues, host: instanceClient.host };
          },
          instance || instanceNames[0] // Use first instance if only one configured
        );

        const found = results.find((r) => r.result !== null);

        if (!found || !found.result) {
          console.log('[Jira] No active sprint found');
          return {
            message: 'No active sprint found for this board. The board may be a Kanban board (which has no sprints) or all sprints may be closed.',
          };
        }

        const { sprint: activeSprint, issues, host } = found.result;
        console.log('[Jira] Active sprint:', activeSprint.name, 'from instance:', found.instance);

        // Group issues by status category
        const issuesByStatus: Record<string, Array<{ key: string; summary: string; assignee?: string; url: string }>> = {};
        for (const issue of issues.issues) {
          const category = issue.fields.status.statusCategory.name;
          if (!issuesByStatus[category]) {
            issuesByStatus[category] = [];
          }
          issuesByStatus[category].push({
            key: issue.key,
            summary: issue.fields.summary,
            assignee: issue.fields.assignee?.displayName,
            url: `https://${host}/browse/${issue.key}`,
          });
        }

        return {
          instance: found.instance,
          host: found.host,
          sprint: {
            id: activeSprint.id,
            name: activeSprint.name,
            state: activeSprint.state,
            startDate: activeSprint.startDate,
            endDate: activeSprint.endDate,
            goal: activeSprint.goal,
          },
          issueCount: issues.total,
          issuesByStatus,
        };
      } catch (error) {
        console.error('[Jira] Get sprint error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message.includes('401') || message.includes('Unauthorized')) {
          return {
            error:
              'Jira authentication failed. Please check your email and API token in Settings → Connectors.',
          };
        }
        if (message.includes('does not support')) {
          return {
            error: `Board ${boardId} does not support sprints. It may be a Kanban board. Use jira_list_boards to find Scrum boards.`,
          };
        }
        return {
          error: `Failed to get sprint: ${message}`,
        };
      }
    },
  });

  const jira_list_projects = tool({
    description:
      'List all Jira projects the user has access to. Returns project keys (used in JQL queries and issue keys), names, and types. Use project keys with jira_search_issues to filter by project. When multiple Jira instances are configured, queries all instances by default.',
    inputSchema: z.object({
      instance: z
        .string()
        .optional()
        .describe(getInstanceDescription(client)),
    }),
    execute: async ({ instance }) => {
      console.log('[Jira] jira_list_projects called with:', { instance });

      if (!client.hasCredentials()) {
        console.log('[Jira] No credentials configured');
        return {
          error:
            'Jira not configured. Please add your host, email, and API token in Settings → Connectors.',
        };
      }

      try {
        console.log('[Jira] Querying instances for projects...');
        const results = await client.queryAllInstances(
          (instanceClient) => instanceClient.listProjects(),
          instance
        );

        if (results.length === 0) {
          return {
            error: instance
              ? `Instance "${instance}" not found. Available instances: ${client.getInstanceNames().join(', ')}`
              : 'No Jira instances configured.',
          };
        }

        // Flatten results from all instances
        const allProjects: Array<{
          instance: string;
          host: string;
          id: string;
          key: string;
          name: string;
          projectTypeKey: string;
          url: string;
        }> = [];

        for (const { instance: instName, host, result } of results) {
          for (const project of result) {
            allProjects.push({
              instance: instName,
              host,
              id: project.id,
              key: project.key,
              name: project.name,
              projectTypeKey: project.projectTypeKey,
              url: `https://${host}/browse/${project.key}`,
            });
          }
        }

        console.log('[Jira] Found', allProjects.length, 'projects across', results.length, 'instances');

        return {
          instancesQueried: results.map((r) => r.instance),
          total: allProjects.length,
          projects: allProjects,
        };
      } catch (error) {
        console.error('[Jira] List projects error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message.includes('401') || message.includes('Unauthorized')) {
          return {
            error:
              'Jira authentication failed. Please check your email and API token in Settings → Connectors.',
          };
        }
        return {
          error: `Failed to list Jira projects: ${message}`,
        };
      }
    },
  });

  // Add a tool to list configured instances
  const jira_list_instances = tool({
    description:
      'List all configured Jira instances. Returns the instance names that can be used to filter other Jira tools.',
    inputSchema: z.object({}),
    execute: async () => {
      console.log('[Jira] jira_list_instances called');

      if (!client.hasCredentials()) {
        return {
          error:
            'Jira not configured. Please add your host, email, and API token in Settings → Connectors.',
        };
      }

      const instances = client.getAllInstances();
      return {
        total: instances.length,
        instances: instances.map((inst) => ({
          name: inst.name,
          host: inst.host,
        })),
      };
    },
  });

  return {
    jira_search_issues,
    jira_get_issue,
    jira_get_issue_comments,
    jira_list_boards,
    jira_get_sprint,
    jira_list_projects,
    jira_list_instances,
  };
}
