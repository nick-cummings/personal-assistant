/**
 * Manual test script for Confluence connector with multi-instance support
 *
 * Usage:
 *   bun run src/lib/connectors/confluence/test-confluence.ts
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
 *   CONFLUENCE_HOST, CONFLUENCE_EMAIL, CONFLUENCE_API_TOKEN
 *   JIRA_HOST, JIRA_EMAIL, JIRA_API_TOKEN
 */

import { ConfluenceClient } from './client';
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
    extractHost(process.env.CONFLUENCE_HOST) ||
    extractHost(process.env.CONFLUENCE_BASE_URL) ||
    extractHost(process.env.JIRA_HOST) ||
    extractHost(process.env.JIRA_BASE_URL);

  const email =
    process.env.ATLASSIAN_EMAIL ||
    process.env.CONFLUENCE_EMAIL ||
    process.env.JIRA_EMAIL;

  const apiToken =
    process.env.ATLASSIAN_API_TOKEN ||
    process.env.CONFLUENCE_API_TOKEN ||
    process.env.JIRA_API_TOKEN;

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
  console.log('=== Confluence Connector Test (Multi-Instance) ===\n');

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

  const client = new ConfluenceClient({ instances });

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
    await client.testConnection();
    console.log('Connection successful!');
    console.log();
  } catch (error) {
    console.error('Connection test failed:', error);
    process.exit(1);
  }

  // Test 4: List spaces across all instances
  console.log('--- Test 4: queryAllInstances - listSpaces() ---');
  let firstSpace: { instance: string; key: string } | null = null;
  try {
    const results = await client.queryAllInstances((instClient) => instClient.listSpaces());
    console.log(`Queried ${results.length} instance(s):`);
    for (const { instance, host, result: spaces } of results) {
      console.log(`\n  Instance: ${instance} (${host})`);
      console.log(`  Found ${spaces.length} spaces:`);
      for (const space of spaces.slice(0, 5)) {
        console.log(`    - ${space.name} (${space.key}): ${space.type}`);
        if (!firstSpace) {
          firstSpace = { instance, key: space.key };
        }
      }
      if (spaces.length > 5) {
        console.log(`    ... and ${spaces.length - 5} more`);
      }
    }
    console.log();
  } catch (error) {
    console.error('List spaces failed:', error);
  }

  // Test 5: Search across all instances
  console.log('--- Test 5: queryAllInstances - search("test", limit: 5) ---');
  let firstPage: { instance: string; id: string } | null = null;
  try {
    const results = await client.queryAllInstances((instClient) => instClient.search('test', undefined, 5));
    console.log(`Queried ${results.length} instance(s):`);
    for (const { instance, host, result } of results) {
      console.log(`\n  Instance: ${instance} (${host})`);
      console.log(`  Found ${result.totalSize} total results, showing ${result.results.length}:`);
      for (const r of result.results.slice(0, 3)) {
        console.log(`    - [${r.content.id}] ${r.content.title}`);
        console.log(`      Space: ${r.content.spaceId}`);
        if (!firstPage) {
          firstPage = { instance, id: r.content.id };
        }
      }
      if (result.results.length > 3) {
        console.log(`    ... and ${result.results.length - 3} more`);
      }
    }
    console.log();
  } catch (error) {
    console.error('Search failed:', error);
  }

  // Test 6: Get specific page from a specific instance
  if (firstPage) {
    console.log(`--- Test 6: getPage("${firstPage.id}") from instance "${firstPage.instance}" ---`);
    try {
      const results = await client.queryAllInstances(
        async (instClient) => {
          try {
            return await instClient.getPage(firstPage!.id);
          } catch {
            return null;
          }
        },
        firstPage.instance
      );
      const found = results.find((r) => r.result !== null);
      if (found && found.result) {
        const page = found.result;
        console.log(`Got page from ${found.instance}:`);
        console.log('  ID:', page.id);
        console.log('  Title:', page.title);
        console.log('  Space:', page.spaceId);
        console.log('  Version:', page.version.number);
        console.log('  Last Modified:', page.version.createdAt);
        console.log('  Content length:', page.bodyContent?.length || 0, 'chars');
        console.log('  Content preview:', page.bodyContent?.substring(0, 150) || '(empty)');
      }
      console.log();
    } catch (error) {
      console.error('Get page failed:', error);
    }
  } else {
    console.log('--- Test 6: Skipped (no pages found) ---\n');
  }

  // Test 7: Get page children from specific instance
  if (firstPage) {
    console.log(`--- Test 7: getPageChildren("${firstPage.id}") from instance "${firstPage.instance}" ---`);
    try {
      const results = await client.queryAllInstances(
        async (instClient) => {
          try {
            return await instClient.getPageChildren(firstPage!.id);
          } catch {
            return null;
          }
        },
        firstPage.instance
      );
      const found = results.find((r) => r.result !== null);
      if (found && found.result) {
        const children = found.result;
        console.log(`Got ${children.length} child pages from ${found.instance}:`);
        for (const child of children.slice(0, 5)) {
          console.log(`  - [${child.id}] ${child.title}`);
        }
        if (children.length > 5) {
          console.log(`  ... and ${children.length - 5} more`);
        }
      } else {
        console.log('No children found or page not found');
      }
      console.log();
    } catch (error) {
      console.error('Get page children failed:', error);
    }
  } else {
    console.log('--- Test 7: Skipped (no pages found) ---\n');
  }

  // Test 8: Search within a specific space across instances
  if (firstSpace) {
    console.log(`--- Test 8: search("guide", spaceKey: "${firstSpace.key}") from "${firstSpace.instance}" ---`);
    try {
      const results = await client.queryAllInstances(
        (instClient) => instClient.search('guide', firstSpace!.key, 3),
        firstSpace.instance
      );
      const found = results[0];
      if (found) {
        console.log(`Found ${found.result.totalSize} results in space ${firstSpace.key} (${found.instance}):`);
        for (const r of found.result.results) {
          console.log(`  - [${r.content.id}] ${r.content.title}`);
        }
      }
      console.log();
    } catch (error) {
      console.error('Search in space failed:', error);
    }
  } else {
    console.log('--- Test 8: Skipped (no spaces found) ---\n');
  }

  // Test 9: List drafts across all instances
  console.log('--- Test 9: queryAllInstances - listDraftPages() ---');
  try {
    const results = await client.queryAllInstances((instClient) => instClient.listDraftPages());
    console.log(`Queried ${results.length} instance(s):`);
    for (const { instance, host, result } of results) {
      console.log(`\n  Instance: ${instance} (${host})`);
      console.log(`  Found ${result.totalSize} draft pages:`);
      for (const draft of result.results.slice(0, 3)) {
        console.log(`    - [${draft.content.id}] ${draft.content.title}`);
        console.log(`      Space: ${draft.content.spaceId}, Status: ${draft.content.status}`);
      }
      if (result.results.length > 3) {
        console.log(`    ... and ${result.results.length - 3} more`);
      }
    }
    console.log();
  } catch (error) {
    console.error('List drafts failed:', error);
  }

  // Test 10: Create a draft page
  if (firstSpace) {
    console.log(`--- Test 10: createDraftPage() in space "${firstSpace.key}" ---`);
    try {
      // Get the space ID (numeric) from the space key
      const spacesResults = await client.queryAllInstances(
        (instClient) => instClient.listSpaces(),
        firstSpace.instance
      );
      const spaces = spacesResults[0]?.result || [];
      const targetSpace = spaces.find((s) => s.key === firstSpace.key);

      if (!targetSpace) {
        console.log(`Could not find space with key "${firstSpace.key}"`);
      } else {
        const testTitle = `Test Draft Page - ${new Date().toISOString()}`;
        const testContent = `This is a test draft page created by the Confluence connector test script.

It was created on ${new Date().toLocaleString()}.

This page should be deleted manually after testing.

Features tested:
- Creating draft pages via API
- Plain text to storage format conversion
- Multi-paragraph content`;

        const instanceClient = client.getInstance(firstSpace.instance);
        if (instanceClient) {
          const draft = await instanceClient.createDraftPage({
            spaceId: String(targetSpace.id),
            title: testTitle,
            content: testContent,
          });

          console.log('Draft page created successfully!');
          console.log('  ID:', draft.id);
          console.log('  Title:', draft.title);
          console.log('  Space ID:', draft.spaceId);
          console.log('  Status:', draft.status);
          console.log('  URL:', `https://${instanceClient.host}/wiki${draft._links.webui}`);
          console.log('  Edit URL:', draft._links.editui
            ? `https://${instanceClient.host}/wiki${draft._links.editui}`
            : `https://${instanceClient.host}/wiki/pages/resumedraft.action?draftId=${draft.id}`);
          console.log('\n  ⚠️  Remember to delete this draft page manually in Confluence!');
        }
      }
      console.log();
    } catch (error) {
      console.error('Create draft page failed:', error);
    }
  } else {
    console.log('--- Test 10: Skipped (no spaces found) ---\n');
  }

  // Test 11: Query specific instance only
  if (instances.length > 1) {
    const targetInstance = instances[0].name;
    console.log(`--- Test 11: Query single instance "${targetInstance}" only ---`);
    try {
      const results = await client.queryAllInstances(
        (instClient) => instClient.listSpaces(),
        targetInstance
      );
      console.log(`Queried instance: ${results.map((r) => r.instance).join(', ')}`);
      console.log(`Found ${results[0]?.result.length || 0} spaces in ${targetInstance}`);
      console.log();
    } catch (error) {
      console.error('Query single instance failed:', error);
    }
  } else {
    console.log('--- Test 11: Skipped (only one instance configured) ---\n');
  }

  console.log('=== All tests complete ===');
}

main().catch(console.error);
