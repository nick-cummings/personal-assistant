import { tool } from 'ai';
import { z } from 'zod';
import { JiraClient, extractTextFromADF } from './client';
import type { ToolSet } from '../types';

export function createJiraTools(client: JiraClient, host: string): ToolSet {
  const jira_search_issues = tool({
    description:
      'Search Jira issues using JQL (Jira Query Language). Returns issue keys, summaries, status, and assignees.',
    inputSchema: z.object({
      jql: z
        .string()
        .describe(
          'JQL query string (e.g., "assignee = currentUser() AND status != Done", "project = PROJ AND sprint in openSprints()")'
        ),
      limit: z.number().optional().default(20).describe('Maximum number of results to return'),
    }),
    execute: async ({ jql, limit }) => {
      const result = await client.searchIssues(jql, limit);

      return {
        total: result.total,
        issues: result.issues.map((issue) => ({
          key: issue.key,
          summary: issue.fields.summary,
          type: issue.fields.issuetype.name,
          status: issue.fields.status.name,
          statusCategory: issue.fields.status.statusCategory.name,
          priority: issue.fields.priority?.name,
          assignee: issue.fields.assignee?.displayName,
          reporter: issue.fields.reporter?.displayName,
          labels: issue.fields.labels,
          project: issue.fields.project.key,
          url: `https://${host}/browse/${issue.key}`,
          created: issue.fields.created,
          updated: issue.fields.updated,
        })),
      };
    },
  });

  const jira_get_issue = tool({
    description: 'Get detailed information about a specific Jira issue including description.',
    inputSchema: z.object({
      issueKey: z.string().describe('Issue key (e.g., "PROJ-123")'),
    }),
    execute: async ({ issueKey }) => {
      const issue = await client.getIssue(issueKey);

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
        url: `https://${host}/browse/${issue.key}`,
        created: issue.fields.created,
        updated: issue.fields.updated,
      };
    },
  });

  const jira_get_issue_comments = tool({
    description: 'Get comments on a Jira issue.',
    inputSchema: z.object({
      issueKey: z.string().describe('Issue key (e.g., "PROJ-123")'),
    }),
    execute: async ({ issueKey }) => {
      const result = await client.getIssueComments(issueKey);

      return {
        total: result.total,
        comments: result.comments.map((comment) => ({
          author: comment.author.displayName,
          body: extractTextFromADF(comment.body as unknown as typeof comment.body),
          created: comment.created,
          updated: comment.updated,
        })),
      };
    },
  });

  const jira_list_boards = tool({
    description: 'List available Jira boards (Scrum and Kanban).',
    inputSchema: z.object({}),
    execute: async () => {
      const result = await client.listBoards();

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
    },
  });

  const jira_get_sprint = tool({
    description: 'Get the active sprint for a board, including sprint issues.',
    inputSchema: z.object({
      boardId: z.number().describe('Board ID (get from jira_list_boards)'),
    }),
    execute: async ({ boardId }) => {
      const sprintsResult = await client.getActiveSprint(boardId);

      if (!sprintsResult.values || sprintsResult.values.length === 0) {
        return { message: 'No active sprint found for this board' };
      }

      const activeSprint = sprintsResult.values[0];
      const issues = await client.getSprintIssues(activeSprint.id);

      // Group issues by status category
      const issuesByStatus: Record<string, Array<{ key: string; summary: string; assignee?: string }>> = {};
      for (const issue of issues.issues) {
        const category = issue.fields.status.statusCategory.name;
        if (!issuesByStatus[category]) {
          issuesByStatus[category] = [];
        }
        issuesByStatus[category].push({
          key: issue.key,
          summary: issue.fields.summary,
          assignee: issue.fields.assignee?.displayName,
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
    },
  });

  return {
    jira_search_issues,
    jira_get_issue,
    jira_get_issue_comments,
    jira_list_boards,
    jira_get_sprint,
  };
}
