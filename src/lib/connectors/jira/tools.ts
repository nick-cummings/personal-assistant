import { tool } from 'ai';
import { z } from 'zod';
import { JiraClient, extractTextFromADF } from './client';
import type { ToolSet } from '../types';

export function createJiraTools(client: JiraClient): ToolSet {
  const jira_search_issues = tool({
    description:
      'Search Jira issues using JQL (Jira Query Language). Returns issue keys (like "PROJ-123"), summaries, status, priority, and assignees. Use jira_get_issue with the issue key to get full details including description.',
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
        .describe('Maximum number of results to return (default: 20)'),
    }),
    execute: async ({ jql, limit }) => {
      console.log('[Jira] jira_search_issues called with:', { jql, limit });

      if (!client.hasCredentials()) {
        console.log('[Jira] No credentials configured');
        return {
          error:
            'Jira not configured. Please add your host, email, and API token in Settings → Connectors.',
        };
      }

      try {
        console.log('[Jira] Calling client.searchIssues...');
        const result = await client.searchIssues(jql, limit);
        console.log('[Jira] Search returned', result.issues.length, 'issues');

        return {
          count: result.issues.length,
          hasMore: !result.isLast,
          issues: result.issues.map((issue) => ({
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
            url: `https://${client.host}/browse/${issue.key}`,
            created: issue.fields.created,
            updated: issue.fields.updated,
          })),
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
      'Get detailed information about a specific Jira issue by its key. Returns the full description, comments count, status, priority, assignee, and other details. Use jira_search_issues first to find issue keys.',
    inputSchema: z.object({
      issueKey: z
        .string()
        .describe(
          'The issue key in the format "PROJECT-NUMBER" (e.g., "PROJ-123", "DEV-456", "BUG-789"). Get this from jira_search_issues results.'
        ),
    }),
    execute: async ({ issueKey }) => {
      console.log('[Jira] jira_get_issue called with issueKey:', issueKey);

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
        console.log('[Jira] Calling client.getIssue...');
        const issue = await client.getIssue(issueKey);
        console.log('[Jira] Got issue:', {
          key: issue.key,
          summary: issue.fields.summary,
        });

        return {
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
          url: `https://${client.host}/browse/${issue.key}`,
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
      'Get all comments on a specific Jira issue. Returns the comment authors, content, and timestamps. Use jira_search_issues or jira_get_issue first to get the issue key.',
    inputSchema: z.object({
      issueKey: z
        .string()
        .describe(
          'The issue key in the format "PROJECT-NUMBER" (e.g., "PROJ-123"). Get this from jira_search_issues results.'
        ),
    }),
    execute: async ({ issueKey }) => {
      console.log('[Jira] jira_get_issue_comments called with issueKey:', issueKey);

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
        console.log('[Jira] Calling client.getIssueComments...');
        const result = await client.getIssueComments(issueKey);
        console.log('[Jira] Found', result.total, 'comments');

        return {
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
      'List all available Jira boards (Scrum and Kanban boards). Returns board IDs, names, types, and associated projects. Use the board ID with jira_get_sprint to get active sprint information.',
    inputSchema: z.object({}),
    execute: async () => {
      console.log('[Jira] jira_list_boards called');

      if (!client.hasCredentials()) {
        console.log('[Jira] No credentials configured');
        return {
          error:
            'Jira not configured. Please add your host, email, and API token in Settings → Connectors.',
        };
      }

      try {
        console.log('[Jira] Calling client.listBoards...');
        const result = await client.listBoards();
        console.log('[Jira] Found', result.total, 'boards');

        return {
          total: result.total,
          boards: result.values.map((board) => ({
            id: board.id,
            name: board.name,
            type: board.type,
            projectKey: board.location?.projectKey,
            projectName: board.location?.projectName,
          })),
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
      'Get the active sprint for a specific board, including all sprint issues grouped by status. Use jira_list_boards first to get board IDs. Only works for Scrum boards (not Kanban).',
    inputSchema: z.object({
      boardId: z
        .number()
        .describe(
          'The numeric board ID as returned by jira_list_boards (e.g., 1, 42, 123). Only Scrum boards have sprints.'
        ),
    }),
    execute: async ({ boardId }) => {
      console.log('[Jira] jira_get_sprint called with boardId:', boardId);

      if (!client.hasCredentials()) {
        console.log('[Jira] No credentials configured');
        return {
          error:
            'Jira not configured. Please add your host, email, and API token in Settings → Connectors.',
        };
      }

      try {
        console.log('[Jira] Calling client.getActiveSprint...');
        const sprintsResult = await client.getActiveSprint(boardId);

        if (!sprintsResult.values || sprintsResult.values.length === 0) {
          console.log('[Jira] No active sprint found');
          return {
            message: 'No active sprint found for this board. The board may be a Kanban board (which has no sprints) or all sprints may be closed.',
          };
        }

        const activeSprint = sprintsResult.values[0];
        console.log('[Jira] Active sprint:', activeSprint.name);

        const issues = await client.getSprintIssues(activeSprint.id);
        console.log('[Jira] Sprint has', issues.total, 'issues');

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
            url: `https://${client.host}/browse/${issue.key}`,
          });
        }

        return {
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
      'List all Jira projects the user has access to. Returns project keys (used in JQL queries and issue keys), names, and types. Use project keys with jira_search_issues to filter by project.',
    inputSchema: z.object({}),
    execute: async () => {
      console.log('[Jira] jira_list_projects called');

      if (!client.hasCredentials()) {
        console.log('[Jira] No credentials configured');
        return {
          error:
            'Jira not configured. Please add your host, email, and API token in Settings → Connectors.',
        };
      }

      try {
        console.log('[Jira] Calling client.listProjects...');
        const projects = await client.listProjects();
        console.log('[Jira] Found', projects.length, 'projects');

        return {
          total: projects.length,
          projects: projects.map((project) => ({
            id: project.id,
            key: project.key,
            name: project.name,
            projectTypeKey: project.projectTypeKey,
            url: `https://${client.host}/browse/${project.key}`,
          })),
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

  return {
    jira_search_issues,
    jira_get_issue,
    jira_get_issue_comments,
    jira_list_boards,
    jira_get_sprint,
    jira_list_projects,
  };
}
