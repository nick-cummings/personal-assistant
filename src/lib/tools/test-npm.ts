/**
 * Manual test script for npm tool
 *
 * Usage:
 *   bun run src/lib/tools/test-npm.ts
 *
 * No environment variables required - this tool uses the public npm registry API.
 */

import { createNpmTool } from './npm';

async function main() {
  console.log('=== NPM Tool Test ===\n');

  const tools = createNpmTool();
  const npm = tools.npm;

  // Test 1: Search for packages by keyword
  console.log('--- Test 1: Search for "validation" packages ---');
  try {
    const result = await npm.execute(
      { operation: 'search', query: 'validation', limit: 5 },
      { toolCallId: 'test-1', messages: [] }
    );
    if ('error' in result) {
      console.log('Error:', result.error);
    } else if ('results' in result) {
      console.log('Query:', result.query);
      console.log('Total found:', result.total);
      console.log('Showing:', result.count);
      console.log('\nResults:');
      for (const pkg of result.results) {
        console.log(`\n  ${pkg.name}@${pkg.version}`);
        console.log(`    ${pkg.description.substring(0, 80)}${pkg.description.length > 80 ? '...' : ''}`);
        console.log(`    Downloads: ${pkg.downloads?.weekly}/week, ${pkg.downloads?.monthly}/month`);
        console.log(`    License: ${pkg.license}, Dependents: ${pkg.dependents}`);
        console.log(`    GitHub: ${pkg.links.github || 'N/A'}`);
      }
    }
    console.log();
  } catch (error) {
    console.error('Failed:', error);
  }

  // Test 2: Search for specific package type
  console.log('--- Test 2: Search for "react state management" ---');
  try {
    const result = await npm.execute(
      { operation: 'search', query: 'react state management', limit: 5 },
      { toolCallId: 'test-2', messages: [] }
    );
    if ('error' in result) {
      console.log('Error:', result.error);
    } else if ('results' in result) {
      console.log('Query:', result.query);
      console.log('Total found:', result.total);
      console.log('\nTop packages:');
      for (const pkg of result.results) {
        console.log(`  - ${pkg.name}@${pkg.version} (${pkg.downloads?.weekly}/week)`);
        console.log(`    ${pkg.description.substring(0, 70)}...`);
        console.log(`    Score: quality=${pkg.score.quality}%, popularity=${pkg.score.popularity}%, maintenance=${pkg.score.maintenance}%`);
      }
    }
    console.log();
  } catch (error) {
    console.error('Failed:', error);
  }

  // Test 3: Get package info for a well-known package
  console.log('--- Test 3: Get info for "zod" ---');
  try {
    const result = await npm.execute(
      { operation: 'info', query: 'zod' },
      { toolCallId: 'test-3', messages: [] }
    );
    if ('error' in result) {
      console.log('Error:', result.error);
    } else if ('latestVersion' in result) {
      console.log('Package:', result.name);
      console.log('Description:', result.description);
      console.log('Latest version:', result.latestVersion);
      console.log('License:', result.license);
      console.log('Keywords:', result.keywords.join(', '));
      console.log('Maintainers:', result.maintainers.join(', '));
      console.log('\nLinks:');
      console.log('  npm:', result.links.npm);
      console.log('  GitHub:', result.links.github);
      console.log('  Homepage:', result.links.homepage);
      console.log('\nDist tags:', JSON.stringify(result.distTags, null, 2));
      console.log('\nRecent versions:');
      for (const v of result.recentVersions) {
        console.log(`  - ${v.version} (${v.date})`);
      }
      console.log('\nCreated:', result.created);
      console.log('Last modified:', result.lastModified);
      if (result.readme) {
        console.log('\nReadme preview (first 500 chars):');
        console.log(result.readme.substring(0, 500) + '...');
      }
    }
    console.log();
  } catch (error) {
    console.error('Failed:', error);
  }

  // Test 4: Get info for a package with lots of versions
  console.log('--- Test 4: Get info for "react" ---');
  try {
    const result = await npm.execute(
      { operation: 'info', query: 'react' },
      { toolCallId: 'test-4', messages: [] }
    );
    if ('error' in result) {
      console.log('Error:', result.error);
    } else if ('latestVersion' in result) {
      console.log('Package:', result.name);
      console.log('Latest version:', result.latestVersion);
      console.log('Dist tags:', Object.entries(result.distTags).map(([k, v]) => `${k}:${v}`).join(', '));
      console.log('GitHub:', result.links.github);
      console.log('Recent versions:');
      for (const v of result.recentVersions) {
        console.log(`  - ${v.version} (${v.date})`);
      }
    }
    console.log();
  } catch (error) {
    console.error('Failed:', error);
  }

  // Test 5: Get info for a scoped package
  console.log('--- Test 5: Get info for "@tanstack/react-query" ---');
  try {
    const result = await npm.execute(
      { operation: 'info', query: '@tanstack/react-query' },
      { toolCallId: 'test-5', messages: [] }
    );
    if ('error' in result) {
      console.log('Error:', result.error);
    } else if ('latestVersion' in result) {
      console.log('Package:', result.name);
      console.log('Description:', result.description);
      console.log('Latest version:', result.latestVersion);
      console.log('License:', result.license);
      console.log('GitHub:', result.links.github);
      console.log('Homepage:', result.links.homepage);
    }
    console.log();
  } catch (error) {
    console.error('Failed:', error);
  }

  // Test 6: Search with limit
  console.log('--- Test 6: Search with custom limit (3 results) ---');
  try {
    const result = await npm.execute(
      { operation: 'search', query: 'date formatting', limit: 3 },
      { toolCallId: 'test-6', messages: [] }
    );
    if ('error' in result) {
      console.log('Error:', result.error);
    } else if ('results' in result) {
      console.log('Query:', result.query);
      console.log('Total found:', result.total);
      console.log('Returned:', result.count);
      for (const pkg of result.results) {
        console.log(`  - ${pkg.name}: ${pkg.description.substring(0, 60)}...`);
      }
    }
    console.log();
  } catch (error) {
    console.error('Failed:', error);
  }

  // Test 7: Error handling - non-existent package
  console.log('--- Test 7: Get info for non-existent package ---');
  try {
    const result = await npm.execute(
      { operation: 'info', query: 'this-package-definitely-does-not-exist-12345xyz' },
      { toolCallId: 'test-7', messages: [] }
    );
    if ('error' in result) {
      console.log('Handled error (expected):', result.error);
    } else {
      console.log('Unexpected success');
    }
    console.log();
  } catch (error) {
    console.error('Threw:', error);
  }

  // Test 8: Search for TypeScript-related packages
  console.log('--- Test 8: Search for "typescript orm" ---');
  try {
    const result = await npm.execute(
      { operation: 'search', query: 'typescript orm', limit: 5 },
      { toolCallId: 'test-8', messages: [] }
    );
    if ('error' in result) {
      console.log('Error:', result.error);
    } else if ('results' in result) {
      console.log('Query:', result.query);
      console.log('Top packages:');
      for (const pkg of result.results) {
        console.log(`  - ${pkg.name}@${pkg.version}`);
        console.log(`    Downloads: ${pkg.downloads?.monthly}/month, Dependents: ${pkg.dependents}`);
        console.log(`    GitHub: ${pkg.links.github || 'N/A'}`);
      }
    }
    console.log();
  } catch (error) {
    console.error('Failed:', error);
  }

  // Test 9: Get info with readme
  console.log('--- Test 9: Get info for "lodash" (check readme) ---');
  try {
    const result = await npm.execute(
      { operation: 'info', query: 'lodash' },
      { toolCallId: 'test-9', messages: [] }
    );
    if ('error' in result) {
      console.log('Error:', result.error);
    } else if ('latestVersion' in result) {
      console.log('Package:', result.name);
      console.log('Latest version:', result.latestVersion);
      console.log('Has readme:', result.readme ? 'Yes' : 'No');
      if (result.readme) {
        console.log('Readme length:', result.readme.length, 'chars');
        console.log('Readme starts with:', result.readme.substring(0, 100) + '...');
      }
    }
    console.log();
  } catch (error) {
    console.error('Failed:', error);
  }

  // Test 10: Search for CLI tools
  console.log('--- Test 10: Search for "cli framework" ---');
  try {
    const result = await npm.execute(
      { operation: 'search', query: 'cli framework', limit: 5 },
      { toolCallId: 'test-10', messages: [] }
    );
    if ('error' in result) {
      console.log('Error:', result.error);
    } else if ('results' in result) {
      console.log('Query:', result.query);
      console.log('Top CLI frameworks:');
      for (const pkg of result.results) {
        console.log(`  - ${pkg.name} (${pkg.downloads?.weekly}/week)`);
        console.log(`    ${pkg.description.substring(0, 70)}...`);
        console.log(`    GitHub: ${pkg.links.github || 'N/A'}`);
      }
    }
    console.log();
  } catch (error) {
    console.error('Failed:', error);
  }

  console.log('=== All tests complete ===');
}

main().catch(console.error);
