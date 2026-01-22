/**
 * Manual test script for Jira connector with multi-instance support
 *
 * Usage:
 *   bun run src/lib/connectors/jira/test-jira.ts
 *
 * Environment variables (in order of precedence):
 *
 * Option 1: Multiple instances (JSON array)
 *   ATLASSIAN_INSTANCES='[{"name":"Work","host":"company.atlassian.net","email":"you@company.com","apiToken":"xxx"},{"name":"Client","host":"client.atlassian.net","email":"you@client.com","apiToken":"yyy"}]'
 *
 * Option 2: Single instance with individual vars
 *   ATLASSIAN_HOST=your-company.atlassian.net
 *   ATLASSIAN_EMAIL=you@company.com
 *   ATLASSIAN_API_TOKEN=your-api-token
 *   ATLASSIAN_INSTANCE_NAME=Work (optional, defaults to "Default")
 *
 * Legacy support (deprecated, will fall back to these if ATLASSIAN_* not set):
 *   JIRA_HOST, JIRA_EMAIL, JIRA_API_TOKEN
 *   CONFLUENCE_HOST, CONFLUENCE_EMAIL, CONFLUENCE_API_TOKEN
 */

import { JiraClient, extractTextFromADF } from './client';
import type { AtlassianInstance } from '../types';

// Parse instances from environment
function getInstances(): AtlassianInstance[] {
  // Option 1: JSON array of instances
  if (process.env.ATLASSIAN_INSTANCES) {
    try {
      const instances = JSON.parse(process.env.ATLASSIAN_INSTANCES);
      if (Array.isArray(instances) && instances.length > 0) {
        return instances.map((inst, idx) => ({
          name: inst.name || `Instance ${idx + 1}`,
          host: extractHost(inst.host),
          email: inst.email,
          apiToken: inst.apiToken,
        }));
      }
    } catch (e) {
      console.error('Failed to parse ATLASSIAN_INSTANCES JSON:', e);
    }
  }

  // Option 2: Single instance from individual vars
  const host =
    extractHost(process.env.ATLASSIAN_HOST) ||
    extractHost(process.env.ATLASSIAN_BASE_URL) ||
    // Legacy fallbacks
    extractHost(process.env.JIRA_HOST) ||
    extractHost(process.env.JIRA_BASE_URL) ||
    extractHost(process.env.CONFLUENCE_HOST) ||
    extractHost(process.env.CONFLUENCE_BASE_URL);

  const email =
    process.env.ATLASSIAN_EMAIL || process.env.JIRA_EMAIL || process.env.CONFLUENCE_EMAIL;

  const apiToken =
    process.env.ATLASSIAN_API_TOKEN ||
    process.env.JIRA_API_TOKEN ||
    process.env.CONFLUENCE_API_TOKEN;

  const name = process.env.ATLASSIAN_INSTANCE_NAME || 'Default';

  if (host && email && apiToken) {
    return [{ name, host, email, apiToken }];
  }

  return [];
}

// Extract host from URL if needed
function extractHost(value: string | undefined): string {
  if (!value) return '';
  const match = value.match(/https?:\/\/([^\/]+)/);
  return match ? match[1] : value;
}

async function main() {
  console.log('=== Jira Connector Test (Multi-Instance) ===\n');

  const instances = getInstances();

  if (instances.length === 0) {
    console.error('Error: No Atlassian instances configured');
    console.error('\nOption 1: Set ATLASSIAN_INSTANCES as a JSON array:');
    console.error(
      '  ATLASSIAN_INSTANCES=\'[{"name":"Work","host":"company.atlassian.net","email":"you@company.com","apiToken":"xxx"}]\''
    );
    console.error('\nOption 2: Set individual environment variables:');
    console.error('  ATLASSIAN_HOST=your-company.atlassian.net');
    console.error('  ATLASSIAN_EMAIL=you@company.com');
    console.error('  ATLASSIAN_API_TOKEN=your-api-token');
    process.exit(1);
  }

  console.log(`Configured ${instances.length} instance(s):`);
  for (const inst of instances) {
    console.log(`  - ${inst.name}: ${inst.host} (${inst.email})`);
  }
  console.log();

  const client = new JiraClient({ instances });

  // Test 1: List instances
  console.log('--- Test 1: getAllInstances() ---');
  const allInstances = client.getAllInstances();
  console.log('Instances:', allInstances.map((i) => `${i.name} (${i.host})`).join(', '));
  console.log();

  // Test 2: Check credentials
  console.log('--- Test 2: hasCredentials() ---');
  console.log('Has credentials:', client.hasCredentials());
  console.log();

  // Test 3: Test connection for each instance
  console.log('--- Test 3: testConnection() ---');
  try {
    const user = await client.testConnection();
    console.log('Connection successful!');
    console.log('  Logged in as:', user.displayName);
    console.log('  Email:', user.emailAddress);
    console.log();
  } catch (error) {
    console.error('Connection test failed:', error);
    process.exit(1);
  }

  // Test 4: List projects across all instances
  console.log('--- Test 4: queryAllInstances - listProjects() ---');
  let firstProject: { instance: string; key: string } | null = null;
  try {
    const results = await client.queryAllInstances((instClient) => instClient.listProjects());
    console.log(`Queried ${results.length} instance(s):`);
    for (const { instance, host, result: projects } of results) {
      console.log(`\n  Instance: ${instance} (${host})`);
      console.log(`  Found ${projects.length} projects:`);
      for (const project of projects.slice(0, 5)) {
        console.log(`    - ${project.name} (${project.key}): ${project.projectTypeKey}`);
        if (!firstProject) {
          firstProject = { instance, key: project.key };
        }
      }
      if (projects.length > 5) {
        console.log(`    ... and ${projects.length - 5} more`);
      }
    }
    console.log();
  } catch (error) {
    console.error('List projects failed:', error);
  }

  // Test 5: Search issues across all instances
  let firstIssue: { instance: string; key: string } | null = null;
  if (firstProject) {
    console.log(`--- Test 5: queryAllInstances - searchIssues() ---`);
    try {
      const results = await client.queryAllInstances((instClient) =>
        instClient.searchIssues('order by created DESC', 5)
      );
      console.log(`Queried ${results.length} instance(s):`);
      for (const { instance, host, result } of results) {
        console.log(`\n  Instance: ${instance} (${host})`);
        console.log(`  Found ${result.issues.length} issues:`);
        for (const issue of result.issues.slice(0, 3)) {
          console.log(`    - [${issue.key}] ${issue.fields.summary}`);
          console.log(`      Status: ${issue.fields.status.name}`);
          if (!firstIssue) {
            firstIssue = { instance, key: issue.key };
          }
        }
        if (result.issues.length > 3) {
          console.log(`    ... and ${result.issues.length - 3} more`);
        }
      }
      console.log();
    } catch (error) {
      console.error('Search issues failed:', error);
    }
  } else {
    console.log('--- Test 5: Skipped (no projects found) ---\n');
  }

  // Test 6: Get specific issue from a specific instance
  if (firstIssue) {
    console.log(
      `--- Test 6: getIssue("${firstIssue.key}") from instance "${firstIssue.instance}" ---`
    );
    try {
      const results = await client.queryAllInstances(async (instClient) => {
        try {
          return await instClient.getIssue(firstIssue!.key);
        } catch {
          return null;
        }
      }, firstIssue.instance);
      const found = results.find((r) => r.result !== null);
      if (found && found.result) {
        const issue = found.result;
        console.log(`Got issue from ${found.instance}:`);
        console.log('  Key:', issue.key);
        console.log('  Summary:', issue.fields.summary);
        console.log('  Type:', issue.fields.issuetype.name);
        console.log('  Status:', issue.fields.status.name);
        console.log('  Assignee:', issue.fields.assignee?.displayName || 'Unassigned');
        const description = extractTextFromADF(issue.fields.description);
        console.log('  Description:', description.substring(0, 150) || '(empty)');
      }
      console.log();
    } catch (error) {
      console.error('Get issue failed:', error);
    }
  } else {
    console.log('--- Test 6: Skipped (no issues found) ---\n');
  }

  // Test 7: List boards across all instances
  console.log('--- Test 7: queryAllInstances - listBoards() ---');
  let scrumBoard: { instance: string; id: number } | null = null;
  try {
    const results = await client.queryAllInstances((instClient) => instClient.listBoards());
    console.log(`Queried ${results.length} instance(s):`);
    for (const { instance, host, result: boards } of results) {
      console.log(`\n  Instance: ${instance} (${host})`);
      console.log(`  Found ${boards.total} boards:`);
      for (const board of boards.values.slice(0, 5)) {
        console.log(`    - [${board.id}] ${board.name} (${board.type})`);
        if (board.type === 'scrum' && !scrumBoard) {
          scrumBoard = { instance, id: board.id };
        }
      }
      if (boards.values.length > 5) {
        console.log(`    ... and ${boards.values.length - 5} more`);
      }
    }
    console.log();
  } catch (error) {
    console.error('List boards failed:', error);
  }

  // Test 8: Get active sprint from specific instance (board IDs are instance-specific)
  if (scrumBoard) {
    console.log(
      `--- Test 8: getActiveSprint(${scrumBoard.id}) from instance "${scrumBoard.instance}" ---`
    );
    try {
      const results = await client.queryAllInstances(
        (instClient) => instClient.getActiveSprint(scrumBoard!.id),
        scrumBoard.instance
      );
      const found = results.find((r) => r.result.values && r.result.values.length > 0);
      if (found && found.result.values && found.result.values.length > 0) {
        const sprint = found.result.values[0];
        console.log(`Active sprint from ${found.instance}:`);
        console.log('  ID:', sprint.id);
        console.log('  Name:', sprint.name);
        console.log('  State:', sprint.state);
        console.log('  Start:', sprint.startDate || 'N/A');
        console.log('  End:', sprint.endDate || 'N/A');
      } else {
        console.log('No active sprint found');
      }
      console.log();
    } catch (error) {
      console.error('Get active sprint failed:', error);
    }
  } else {
    console.log('--- Test 8: Skipped (no Scrum boards found) ---\n');
  }

  // Test 9: Query specific instance only
  if (instances.length > 1) {
    const targetInstance = instances[0].name;
    console.log(`--- Test 9: Query single instance "${targetInstance}" only ---`);
    try {
      const results = await client.queryAllInstances(
        (instClient) => instClient.listProjects(),
        targetInstance
      );
      console.log(`Queried instance: ${results.map((r) => r.instance).join(', ')}`);
      console.log(`Found ${results[0]?.result.length || 0} projects in ${targetInstance}`);
      console.log();
    } catch (error) {
      console.error('Query single instance failed:', error);
    }
  } else {
    console.log('--- Test 9: Skipped (only one instance configured) ---\n');
  }

  console.log('=== All tests complete ===');
}

main().catch(console.error);
