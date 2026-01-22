/**
 * Manual test script for web_search tool
 *
 * Usage:
 *   bun run src/lib/tools/test-web-search.ts
 *
 * Environment variables required:
 *   SERP_API_KEY=your-serpapi-key
 *
 * Get a free API key at https://serpapi.com/
 */

import { createWebSearchTool } from './web-search';

async function main() {
  console.log('=== Web Search Tool Test ===\n');

  const apiKey = process.env.SERP_API_KEY;

  if (!apiKey) {
    console.error('Error: SERP_API_KEY environment variable is required');
    console.error('Get a free API key at https://serpapi.com/');
    console.error('\nUsage:');
    console.error('  SERP_API_KEY=xxx bun run src/lib/tools/test-web-search.ts');
    process.exit(1);
  }

  console.log('API Key:', apiKey.substring(0, 8) + '...');
  console.log();

  const tools = createWebSearchTool(apiKey);
  const webSearch = tools.web_search;

  // Test 1: Simple search
  console.log('--- Test 1: Simple search ---');
  try {
    const result = await webSearch.execute(
      { query: 'TypeScript tutorial' },
      { toolCallId: 'test-1', messages: [] }
    );
    if ('error' in result) {
      console.log('Error:', result.error);
    } else {
      console.log('Query:', result.query);
      console.log('Results count:', result.results?.length || 0);
      if (result.answerBox) {
        console.log('\nAnswer Box:');
        console.log('  Type:', result.answerBox.type);
        console.log('  Title:', result.answerBox.title);
        console.log('  Answer:', result.answerBox.answer?.substring(0, 200) + '...');
      }
      console.log('\nTop results:');
      for (const r of (result.results || []).slice(0, 3)) {
        console.log(`  - ${r.title}`);
        console.log(`    ${r.url}`);
        console.log(`    ${r.snippet?.substring(0, 100)}...`);
        console.log();
      }
    }
  } catch (error) {
    console.error('Failed:', error);
  }

  // Test 2: Search with limit
  console.log('--- Test 2: Search with custom limit (5 results) ---');
  try {
    const result = await webSearch.execute(
      { query: 'best programming languages 2024', numResults: 5 },
      { toolCallId: 'test-2', messages: [] }
    );
    if ('error' in result) {
      console.log('Error:', result.error);
    } else {
      console.log('Query:', result.query);
      console.log('Results count:', result.results?.length || 0);
      for (const r of result.results || []) {
        console.log(`  - ${r.title}`);
      }
    }
    console.log();
  } catch (error) {
    console.error('Failed:', error);
  }

  // Test 3: Search that might return knowledge graph
  console.log('--- Test 3: Search with potential knowledge graph ---');
  try {
    const result = await webSearch.execute(
      { query: 'Albert Einstein' },
      { toolCallId: 'test-3', messages: [] }
    );
    if ('error' in result) {
      console.log('Error:', result.error);
    } else {
      console.log('Query:', result.query);
      if (result.knowledgeGraph) {
        console.log('\nKnowledge Graph:');
        console.log('  Title:', result.knowledgeGraph.title);
        console.log('  Type:', result.knowledgeGraph.type);
        console.log('  Description:', result.knowledgeGraph.description?.substring(0, 200) + '...');
        if (result.knowledgeGraph.attributes) {
          console.log('  Attributes:');
          for (const [key, value] of Object.entries(result.knowledgeGraph.attributes).slice(0, 5)) {
            console.log(`    ${key}: ${value}`);
          }
        }
      } else {
        console.log('No knowledge graph returned');
      }
      console.log('\nTop 3 results:');
      for (const r of (result.results || []).slice(0, 3)) {
        console.log(`  - ${r.title}`);
      }
    }
    console.log();
  } catch (error) {
    console.error('Failed:', error);
  }

  // Test 4: Search with answer box (calculation/conversion)
  console.log('--- Test 4: Search that triggers answer box ---');
  try {
    const result = await webSearch.execute(
      { query: 'what time is it in Tokyo' },
      { toolCallId: 'test-4', messages: [] }
    );
    if ('error' in result) {
      console.log('Error:', result.error);
    } else {
      console.log('Query:', result.query);
      if (result.answerBox) {
        console.log('\nAnswer Box:');
        console.log('  Type:', result.answerBox.type);
        console.log('  Title:', result.answerBox.title);
        console.log('  Answer:', result.answerBox.answer);
        console.log('  Snippet:', result.answerBox.snippet);
      } else {
        console.log('No answer box returned');
      }
    }
    console.log();
  } catch (error) {
    console.error('Failed:', error);
  }

  // Test 5: Technical/programming search
  console.log('--- Test 5: Technical programming search ---');
  try {
    const result = await webSearch.execute(
      { query: 'React useEffect cleanup function' },
      { toolCallId: 'test-5', messages: [] }
    );
    if ('error' in result) {
      console.log('Error:', result.error);
    } else {
      console.log('Query:', result.query);
      console.log('Results count:', result.results?.length || 0);
      console.log('\nTop results:');
      for (const r of (result.results || []).slice(0, 5)) {
        console.log(`  - ${r.title}`);
        console.log(`    ${r.url}`);
        console.log();
      }
    }
  } catch (error) {
    console.error('Failed:', error);
  }

  // Test 6: News/current events search
  console.log('--- Test 6: News/current events search ---');
  try {
    const result = await webSearch.execute(
      { query: 'latest AI news' },
      { toolCallId: 'test-6', messages: [] }
    );
    if ('error' in result) {
      console.log('Error:', result.error);
    } else {
      console.log('Query:', result.query);
      console.log('Results count:', result.results?.length || 0);
      console.log('\nTop results:');
      for (const r of (result.results || []).slice(0, 5)) {
        console.log(`  - ${r.title}`);
        console.log(`    ${r.url}`);
        if (r.date) console.log(`    Date: ${r.date}`);
        console.log();
      }
    }
  } catch (error) {
    console.error('Failed:', error);
  }

  // Test 7: Local search
  console.log('--- Test 7: Local/location search ---');
  try {
    const result = await webSearch.execute(
      { query: 'coffee shops near Seattle' },
      { toolCallId: 'test-7', messages: [] }
    );
    if ('error' in result) {
      console.log('Error:', result.error);
    } else {
      console.log('Query:', result.query);
      console.log('Results count:', result.results?.length || 0);
      console.log('\nTop results:');
      for (const r of (result.results || []).slice(0, 5)) {
        console.log(`  - ${r.title}`);
        console.log(`    ${r.url}`);
        console.log();
      }
    }
  } catch (error) {
    console.error('Failed:', error);
  }

  // Test 8: Question search
  console.log('--- Test 8: Question/how-to search ---');
  try {
    const result = await webSearch.execute(
      { query: 'how to center a div in CSS' },
      { toolCallId: 'test-8', messages: [] }
    );
    if ('error' in result) {
      console.log('Error:', result.error);
    } else {
      console.log('Query:', result.query);
      if (result.answerBox) {
        console.log('\nAnswer Box:');
        console.log('  Type:', result.answerBox.type);
        console.log('  Answer:', result.answerBox.answer?.substring(0, 300) || result.answerBox.snippet?.substring(0, 300));
      }
      console.log('\nTop results:');
      for (const r of (result.results || []).slice(0, 3)) {
        console.log(`  - ${r.title}`);
        console.log(`    ${r.url}`);
        console.log();
      }
    }
  } catch (error) {
    console.error('Failed:', error);
  }

  // Test 9: Empty/minimal results
  console.log('--- Test 9: Obscure query ---');
  try {
    const result = await webSearch.execute(
      { query: 'xyzzy12345plugh67890' },
      { toolCallId: 'test-9', messages: [] }
    );
    if ('error' in result) {
      console.log('Error:', result.error);
    } else {
      console.log('Query:', result.query);
      console.log('Results count:', result.results?.length || 0);
      if (result.results && result.results.length > 0) {
        console.log('First result:', result.results[0].title);
      } else {
        console.log('No results found (expected for obscure query)');
      }
    }
    console.log();
  } catch (error) {
    console.error('Failed:', error);
  }

  console.log('=== All tests complete ===');
}

main().catch(console.error);
