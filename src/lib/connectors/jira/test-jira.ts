/**
 * Manual test script for Jira connector
 *
 * Usage:
 *   bun run src/lib/connectors/jira/test-jira.ts
 *
 * Make sure to set environment variables in .env:
 *   JIRA_HOST or JIRA_BASE_URL=your-company.atlassian.net
 *   JIRA_EMAIL=you@company.com
 *   JIRA_API_TOKEN=your-api-token
 */

import { JiraClient, extractTextFromADF } from './client';

// Support JIRA_HOST, JIRA_BASE_URL, or fallback to CONFLUENCE_BASE_URL (same Atlassian instance)
function getHost(): string {
  if (process.env.JIRA_HOST) {
    return process.env.JIRA_HOST;
  }
  if (process.env.JIRA_BASE_URL) {
    const url = process.env.JIRA_BASE_URL;
    const match = url.match(/https?:\/\/([^\/]+)/);
    return match ? match[1] : url;
  }
  // Fallback to Confluence host (same Atlassian instance)
  if (process.env.CONFLUENCE_BASE_URL) {
    const url = process.env.CONFLUENCE_BASE_URL;
    const match = url.match(/https?:\/\/([^\/]+)/);
    return match ? match[1] : url;
  }
  if (process.env.CONFLUENCE_HOST) {
    return process.env.CONFLUENCE_HOST;
  }
  return '';
}

const config = {
  host: getHost(),
  // Jira and Confluence use the same Atlassian credentials
  email:
    process.env.JIRA_EMAIL ||
    process.env.CONFLUENCE_EMAIL ||
    process.env.ATLASSIAN_EMAIL ||
    process.env.ATTLASSIAN_EMAIL || // typo variant
    '',
  apiToken:
    process.env.JIRA_API_TOKEN ||
    process.env.CONFLUENCE_API_TOKEN ||
    process.env.ATLASSIAN_API_TOKEN ||
    process.env.ATTLASSIAN_API_TOKEN || // typo variant
    '',
};

async function main() {
  console.log('=== Jira Connector Test ===\n');

  if (!config.host || !config.email || !config.apiToken) {
    console.error('Error: Missing credentials');
    console.error('Set JIRA_HOST/JIRA_EMAIL/JIRA_API_TOKEN or use existing CONFLUENCE_* environment variables');
    console.error('(Jira and Confluence share the same Atlassian credentials)');
    console.error('Example:');
    console.error(
      '  JIRA_HOST=your-company.atlassian.net JIRA_EMAIL=you@company.com JIRA_API_TOKEN=xxxx bun run src/lib/connectors/jira/test-jira.ts'
    );
    process.exit(1);
  }

  console.log('Host:', config.host);
  console.log('Email:', config.email);
  console.log('API Token:', config.apiToken.substring(0, 4) + '...\n');

  const client = new JiraClient(config);

  // Test 1: Check credentials method
  console.log('--- Test 1: hasCredentials() ---');
  console.log('Has credentials:', client.hasCredentials());
  console.log();

  // Test 2: Test connection
  console.log('--- Test 2: testConnection() ---');
  try {
    const user = await client.testConnection();
    console.log('Connection successful!');
    console.log('  Logged in as:', user.displayName);
    console.log('  Email:', user.emailAddress);
    console.log();
  } catch (error) {
    console.error('Connection failed:', error);
    process.exit(1);
  }

  // Test 3: List projects
  console.log('--- Test 3: listProjects() ---');
  let firstProjectKey: string | null = null;
  try {
    const projects = await client.listProjects();
    console.log('Found', projects.length, 'projects:');
    for (const project of projects.slice(0, 10)) {
      console.log(`  - ${project.name} (${project.key}): ${project.projectTypeKey}`);
      if (!firstProjectKey) {
        firstProjectKey = project.key;
      }
    }
    if (projects.length > 10) {
      console.log(`  ... and ${projects.length - 10} more`);
    }
    console.log();
  } catch (error) {
    console.error('List projects failed:', error);
  }

  // Test 4: Search issues (need a project filter in new API)
  console.log(`--- Test 4: searchIssues("project = ${firstProjectKey || 'ANY'} order by created DESC", limit: 5) ---`);
  let firstIssueKey: string | null = null;
  try {
    const jql = firstProjectKey ? `project = ${firstProjectKey} order by created DESC` : 'order by created DESC';
    const results = await client.searchIssues(jql, 5);
    console.log('Found', results.issues.length, 'issues (hasMore:', !results.isLast, '):');
    for (const issue of results.issues) {
      console.log(`  - [${issue.key}] ${issue.fields.summary}`);
      console.log(`    Status: ${issue.fields.status.name}, Priority: ${issue.fields.priority?.name || 'None'}`);
      console.log(`    Assignee: ${issue.fields.assignee?.displayName || 'Unassigned'}`);
      console.log();
      if (!firstIssueKey) {
        firstIssueKey = issue.key;
      }
    }
  } catch (error) {
    console.error('Search issues failed:', error);
  }

  // Test 5: Get specific issue
  if (firstIssueKey) {
    console.log(`--- Test 5: getIssue("${firstIssueKey}") ---`);
    try {
      const issue = await client.getIssue(firstIssueKey);
      console.log('Got issue:');
      console.log('  Key:', issue.key);
      console.log('  Summary:', issue.fields.summary);
      console.log('  Type:', issue.fields.issuetype.name);
      console.log('  Status:', issue.fields.status.name);
      console.log('  Priority:', issue.fields.priority?.name || 'None');
      console.log('  Assignee:', issue.fields.assignee?.displayName || 'Unassigned');
      console.log('  Reporter:', issue.fields.reporter?.displayName);
      console.log('  Project:', issue.fields.project.name);
      console.log('  Labels:', issue.fields.labels.join(', ') || 'None');
      const description = extractTextFromADF(issue.fields.description);
      console.log('  Description:', description.substring(0, 200) || '(empty)');
      console.log();
    } catch (error) {
      console.error('Get issue failed:', error);
    }
  } else {
    console.log('--- Test 5: Skipped (no issues found) ---\n');
  }

  // Test 6: Get issue comments
  if (firstIssueKey) {
    console.log(`--- Test 6: getIssueComments("${firstIssueKey}") ---`);
    try {
      const comments = await client.getIssueComments(firstIssueKey);
      console.log('Found', comments.total, 'comments:');
      for (const comment of comments.comments.slice(0, 3)) {
        const body = extractTextFromADF(comment.body as unknown as typeof comment.body);
        console.log(`  - ${comment.author.displayName} (${comment.created}):`);
        console.log(`    ${body.substring(0, 100)}${body.length > 100 ? '...' : ''}`);
      }
      if (comments.comments.length > 3) {
        console.log(`  ... and ${comments.comments.length - 3} more comments`);
      }
      console.log();
    } catch (error) {
      console.error('Get comments failed:', error);
    }
  } else {
    console.log('--- Test 6: Skipped (no issues found) ---\n');
  }

  // Test 7: List boards
  console.log('--- Test 7: listBoards() ---');
  let firstBoardId: number | null = null;
  let scrumBoardId: number | null = null;
  try {
    const boards = await client.listBoards();
    console.log('Found', boards.total, 'boards:');
    for (const board of boards.values.slice(0, 10)) {
      console.log(`  - [${board.id}] ${board.name} (${board.type})`);
      console.log(`    Project: ${board.location?.projectName || 'N/A'}`);
      if (!firstBoardId) {
        firstBoardId = board.id;
      }
      if (board.type === 'scrum' && !scrumBoardId) {
        scrumBoardId = board.id;
      }
    }
    if (boards.values.length > 10) {
      console.log(`  ... and ${boards.values.length - 10} more`);
    }
    console.log();
  } catch (error) {
    console.error('List boards failed:', error);
  }

  // Test 8: Get active sprint (only for Scrum boards)
  if (scrumBoardId) {
    console.log(`--- Test 8: getActiveSprint(${scrumBoardId}) ---`);
    try {
      const sprints = await client.getActiveSprint(scrumBoardId);
      if (sprints.values && sprints.values.length > 0) {
        const sprint = sprints.values[0];
        console.log('Active sprint found:');
        console.log('  ID:', sprint.id);
        console.log('  Name:', sprint.name);
        console.log('  State:', sprint.state);
        console.log('  Start:', sprint.startDate || 'N/A');
        console.log('  End:', sprint.endDate || 'N/A');
        console.log('  Goal:', sprint.goal || 'None');

        // Get sprint issues
        const issues = await client.getSprintIssues(sprint.id);
        console.log('  Issues in sprint:', issues.issues.length);
      } else {
        console.log('No active sprint found for this board');
      }
      console.log();
    } catch (error) {
      console.error('Get active sprint failed:', error);
    }
  } else if (firstBoardId) {
    console.log(`--- Test 8: Skipped (no Scrum boards found, board ${firstBoardId} is Kanban) ---\n`);
  } else {
    console.log('--- Test 8: Skipped (no boards found) ---\n');
  }

  // Test 9: Search by project (different query than Test 4)
  if (firstProjectKey) {
    console.log(`--- Test 9: searchIssues("project = ${firstProjectKey} AND status != Done", limit: 3) ---`);
    try {
      const results = await client.searchIssues(`project = ${firstProjectKey} AND status != Done`, 3);
      console.log('Found', results.issues.length, 'open issues in project', firstProjectKey, ':');
      for (const issue of results.issues) {
        console.log(`  - [${issue.key}] ${issue.fields.summary}`);
      }
      console.log();
    } catch (error) {
      console.error('Search in project failed:', error);
    }
  } else {
    console.log('--- Test 9: Skipped (no projects found) ---\n');
  }

  console.log('=== All tests complete ===');
}

main().catch(console.error);
