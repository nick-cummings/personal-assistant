/**
 * Manual test script for web_fetch tool
 *
 * Usage:
 *   bun run src/lib/tools/test-web-fetch.ts
 *
 * No environment variables required - this tool works standalone.
 */

import { createWebFetchTool } from './web-fetch';

async function main() {
  console.log('=== Web Fetch Tool Test ===\n');

  const tools = createWebFetchTool();
  const webFetch = tools.web_fetch;

  // Test 1: Fetch a simple HTML page
  console.log('--- Test 1: Fetch HTML page (example.com) ---');
  try {
    const result = await webFetch.execute(
      { url: 'https://example.com' },
      { toolCallId: 'test-1', messages: [] }
    );
    if ('error' in result) {
      console.log('Error:', result.error);
    } else {
      console.log('URL:', result.url);
      console.log('Title:', result.title);
      console.log('Content length:', result.content?.length || 0, 'chars');
      console.log('Content preview:', result.content?.substring(0, 200) + '...');
    }
    console.log();
  } catch (error) {
    console.error('Failed:', error);
  }

  // Test 2: Fetch with custom max length
  console.log('--- Test 2: Fetch with max length (500 chars) ---');
  try {
    const result = await webFetch.execute(
      { url: 'https://example.com', maxLength: 500 },
      { toolCallId: 'test-2', messages: [] }
    );
    if ('error' in result) {
      console.log('Error:', result.error);
    } else {
      console.log('URL:', result.url);
      console.log('Content length:', result.content?.length || 0, 'chars');
      console.log('Truncated:', result.truncated);
      console.log('Original length:', result.originalLength);
    }
    console.log();
  } catch (error) {
    console.error('Failed:', error);
  }

  // Test 3: Fetch JSON content
  console.log('--- Test 3: Fetch JSON content ---');
  try {
    const result = await webFetch.execute(
      { url: 'https://jsonplaceholder.typicode.com/todos/1' },
      { toolCallId: 'test-3', messages: [] }
    );
    if ('error' in result) {
      console.log('Error:', result.error);
    } else {
      console.log('URL:', result.url);
      console.log('Content type:', result.contentType);
      console.log('Content:', result.content);
    }
    console.log();
  } catch (error) {
    console.error('Failed:', error);
  }

  // Test 4: Fetch plain text
  console.log('--- Test 4: Fetch plain text (robots.txt) ---');
  try {
    const result = await webFetch.execute(
      { url: 'https://www.google.com/robots.txt', maxLength: 500 },
      { toolCallId: 'test-4', messages: [] }
    );
    if ('error' in result) {
      console.log('Error:', result.error);
    } else {
      console.log('URL:', result.url);
      console.log('Content type:', result.contentType);
      console.log('Content preview:', result.content?.substring(0, 300) + '...');
      console.log('Truncated:', result.truncated);
    }
    console.log();
  } catch (error) {
    console.error('Failed:', error);
  }

  // Test 5: Fetch a documentation page
  console.log('--- Test 5: Fetch documentation page ---');
  try {
    const result = await webFetch.execute(
      { url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript', maxLength: 2000 },
      { toolCallId: 'test-5', messages: [] }
    );
    if ('error' in result) {
      console.log('Error:', result.error);
    } else {
      console.log('URL:', result.url);
      console.log('Title:', result.title);
      console.log('Description:', result.description);
      console.log('Content length:', result.content?.length || 0, 'chars');
      console.log('Truncated:', result.truncated);
      console.log('Content preview:', result.content?.substring(0, 300) + '...');
    }
    console.log();
  } catch (error) {
    console.error('Failed:', error);
  }

  // Test 6: Error handling - invalid URL
  console.log('--- Test 6: Error handling - invalid URL ---');
  try {
    const result = await webFetch.execute(
      { url: 'not-a-valid-url' },
      { toolCallId: 'test-6', messages: [] }
    );
    console.log('Result:', result);
    console.log();
  } catch (error) {
    console.log('Caught error (expected):', error);
    console.log();
  }

  // Test 7: Error handling - non-existent domain
  console.log('--- Test 7: Error handling - non-existent domain ---');
  try {
    const result = await webFetch.execute(
      { url: 'https://this-domain-does-not-exist-12345.com' },
      { toolCallId: 'test-7', messages: [] }
    );
    if ('error' in result) {
      console.log('Handled error:', result.error);
    } else {
      console.log('Unexpected success:', result);
    }
    console.log();
  } catch (error) {
    console.error('Threw:', error);
  }

  // Test 8: Error handling - 404 page
  console.log('--- Test 8: Error handling - 404 page ---');
  try {
    const result = await webFetch.execute(
      { url: 'https://example.com/this-page-does-not-exist-12345' },
      { toolCallId: 'test-8', messages: [] }
    );
    if ('error' in result) {
      console.log('Handled error:', result.error);
    } else {
      console.log('URL:', result.url);
      console.log('(Note: Some servers return 200 with error content)');
    }
    console.log();
  } catch (error) {
    console.error('Threw:', error);
  }

  // Test 9: Fetch a news/article site
  console.log('--- Test 9: Fetch news site ---');
  try {
    const result = await webFetch.execute(
      { url: 'https://news.ycombinator.com/', maxLength: 3000 },
      { toolCallId: 'test-9', messages: [] }
    );
    if ('error' in result) {
      console.log('Error:', result.error);
    } else {
      console.log('URL:', result.url);
      console.log('Title:', result.title);
      console.log('Content length:', result.content?.length || 0, 'chars');
      console.log('Content preview (first 500 chars):');
      console.log(result.content?.substring(0, 500) + '...');
    }
    console.log();
  } catch (error) {
    console.error('Failed:', error);
  }

  // Test 10: Fetch GitHub README (rendered HTML)
  console.log('--- Test 10: Fetch GitHub page ---');
  try {
    const result = await webFetch.execute(
      { url: 'https://github.com/vercel/next.js', maxLength: 2000 },
      { toolCallId: 'test-10', messages: [] }
    );
    if ('error' in result) {
      console.log('Error:', result.error);
    } else {
      console.log('URL:', result.url);
      console.log('Title:', result.title);
      console.log('Description:', result.description);
      console.log('Content length:', result.content?.length || 0, 'chars');
      console.log('Truncated:', result.truncated);
    }
    console.log();
  } catch (error) {
    console.error('Failed:', error);
  }

  console.log('=== All tests complete ===');
}

main().catch(console.error);
