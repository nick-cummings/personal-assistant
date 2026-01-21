/**
 * Manual test script for Confluence connector
 *
 * Usage:
 *   bun run src/lib/connectors/confluence/test-confluence.ts
 *
 * Make sure to set environment variables in .env:
 *   CONFLUENCE_HOST or CONFLUENCE_BASE_URL=your-company.atlassian.net
 *   CONFLUENCE_EMAIL=you@company.com
 *   CONFLUENCE_API_TOKEN=your-api-token
 */

import { ConfluenceClient } from './client';

// Support both CONFLUENCE_HOST and CONFLUENCE_BASE_URL (extract host from URL if needed)
function getHost(): string {
  if (process.env.CONFLUENCE_HOST) {
    return process.env.CONFLUENCE_HOST;
  }
  if (process.env.CONFLUENCE_BASE_URL) {
    // Extract host from URL like "https://nick-cummings.atlassian.net/wiki"
    const url = process.env.CONFLUENCE_BASE_URL;
    const match = url.match(/https?:\/\/([^\/]+)/);
    return match ? match[1] : url;
  }
  return '';
}

const config = {
  host: getHost(),
  email: process.env.CONFLUENCE_EMAIL || '',
  apiToken: process.env.CONFLUENCE_API_TOKEN || '',
};

async function main() {
  console.log('=== Confluence Connector Test ===\n');

  if (!config.host || !config.email || !config.apiToken) {
    console.error('Error: Missing credentials');
    console.error('Set CONFLUENCE_HOST (or CONFLUENCE_BASE_URL), CONFLUENCE_EMAIL, and CONFLUENCE_API_TOKEN environment variables');
    console.error('Example:');
    console.error(
      '  CONFLUENCE_HOST=your-company.atlassian.net CONFLUENCE_EMAIL=you@company.com CONFLUENCE_API_TOKEN=xxxx bun run src/lib/connectors/confluence/test-confluence.ts'
    );
    process.exit(1);
  }

  console.log('Host:', config.host);
  console.log('Email:', config.email);
  console.log('API Token:', config.apiToken.substring(0, 4) + '...\n');

  const client = new ConfluenceClient(config);

  // Test 1: Check credentials method
  console.log('--- Test 1: hasCredentials() ---');
  console.log('Has credentials:', client.hasCredentials());
  console.log();

  // Test 2: Test connection
  console.log('--- Test 2: testConnection() ---');
  try {
    await client.testConnection();
    console.log('Connection successful!\n');
  } catch (error) {
    console.error('Connection failed:', error);
    process.exit(1);
  }

  // Test 3: List spaces
  console.log('--- Test 3: listSpaces() ---');
  let firstSpaceKey: string | null = null;
  try {
    const spaces = await client.listSpaces();
    console.log('Found', spaces.length, 'spaces:');
    for (const space of spaces.slice(0, 10)) {
      console.log(`  - ${space.name} (${space.key}): ${space.type}`);
      if (!firstSpaceKey) {
        firstSpaceKey = space.key;
      }
    }
    if (spaces.length > 10) {
      console.log(`  ... and ${spaces.length - 10} more`);
    }
    console.log();
  } catch (error) {
    console.error('List spaces failed:', error);
  }

  // Test 4: Search for content
  console.log('--- Test 4: search("test", limit: 5) ---');
  let firstPageId: string | null = null;
  try {
    const results = await client.search('test', undefined, 5);
    console.log('Found', results.totalSize, 'total results, showing', results.results.length, ':');
    for (const result of results.results) {
      console.log(`  - [${result.content.id}] ${result.content.title}`);
      console.log(`    Space: ${result.content.spaceId}`);
      console.log(`    Excerpt: ${result.excerpt.substring(0, 100)}...`);
      console.log();
      if (!firstPageId) {
        firstPageId = result.content.id;
      }
    }
  } catch (error) {
    console.error('Search failed:', error);
  }

  // Test 5: Get specific page
  if (firstPageId) {
    console.log('--- Test 5: getPage("' + firstPageId + '") ---');
    try {
      const page = await client.getPage(firstPageId);
      console.log('Got page:');
      console.log('  ID:', page.id);
      console.log('  Title:', page.title);
      console.log('  Space:', page.spaceId);
      console.log('  Version:', page.version.number);
      console.log('  Last Modified:', page.version.createdAt);
      console.log('  Content length:', page.bodyContent?.length || 0, 'chars');
      console.log('  Content preview:', page.bodyContent?.substring(0, 200) || '(empty)');
      console.log();
    } catch (error) {
      console.error('Get page failed:', error);
    }
  } else {
    console.log('--- Test 5: Skipped (no pages found) ---\n');
  }

  // Test 6: Get page children
  if (firstPageId) {
    console.log('--- Test 6: getPageChildren("' + firstPageId + '") ---');
    try {
      const children = await client.getPageChildren(firstPageId);
      console.log('Found', children.length, 'child pages:');
      for (const child of children.slice(0, 5)) {
        console.log(`  - [${child.id}] ${child.title}`);
      }
      if (children.length > 5) {
        console.log(`  ... and ${children.length - 5} more`);
      }
      console.log();
    } catch (error) {
      console.error('Get page children failed:', error);
    }
  } else {
    console.log('--- Test 6: Skipped (no pages found) ---\n');
  }

  // Test 7: Search within a specific space
  if (firstSpaceKey) {
    console.log(`--- Test 7: search("guide", spaceKey: "${firstSpaceKey}", limit: 3) ---`);
    try {
      const results = await client.search('guide', firstSpaceKey, 3);
      console.log('Found', results.totalSize, 'results in space', firstSpaceKey, ':');
      for (const result of results.results) {
        console.log(`  - [${result.content.id}] ${result.content.title}`);
      }
      console.log();
    } catch (error) {
      console.error('Search in space failed:', error);
    }
  } else {
    console.log('--- Test 7: Skipped (no spaces found) ---\n');
  }

  // Test 8: List draft pages (using REST API v1)
  console.log('--- Test 8: listDraftPages() ---');
  try {
    const drafts = await client.listDraftPages();
    console.log('Found', drafts.totalSize, 'draft pages:');
    for (const draft of drafts.results.slice(0, 5)) {
      console.log(`  - [${draft.content.id}] ${draft.content.title}`);
      console.log(`    Space: ${draft.content.spaceId}, Status: ${draft.content.status}`);
    }
    if (drafts.results.length > 5) {
      console.log(`  ... and ${drafts.results.length - 5} more`);
    }
    console.log();
  } catch (error) {
    console.error('List draft pages failed:', error);
  }

  console.log('=== All tests complete ===');
}

main().catch(console.error);
