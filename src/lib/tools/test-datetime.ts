/**
 * Manual test script for datetime tool
 *
 * Usage:
 *   bun run src/lib/tools/test-datetime.ts
 *
 * No environment variables required - this tool works standalone.
 */

import { createDateTimeTool } from './datetime';

async function main() {
  console.log('=== DateTime Tool Test ===\n');

  const tools = createDateTimeTool();
  const datetime = tools.datetime;

  // Test 1: Get current time in UTC
  console.log('--- Test 1: Get current time (UTC) ---');
  try {
    const result = await datetime.execute(
      { operation: 'current', timezone: 'UTC' },
      { toolCallId: 'test-1', messages: [] }
    );
    console.log('Result:', JSON.stringify(result, null, 2));
    console.log();
  } catch (error) {
    console.error('Failed:', error);
  }

  // Test 2: Get current time in different timezones
  console.log('--- Test 2: Get current time in various timezones ---');
  const timezones = ['America/New_York', 'America/Los_Angeles', 'Europe/London', 'Asia/Tokyo', 'PST', 'EST'];
  for (const tz of timezones) {
    try {
      const result = await datetime.execute(
        { operation: 'current', timezone: tz },
        { toolCallId: `test-2-${tz}`, messages: [] }
      );
      if ('error' in result) {
        console.log(`  ${tz}: ERROR - ${result.error}`);
      } else {
        console.log(`  ${tz}: ${result.time} (${result.dayOfWeek}, ${result.date})`);
      }
    } catch (error) {
      console.error(`  ${tz}: Failed -`, error);
    }
  }
  console.log();

  // Test 3: Parse relative dates
  console.log('--- Test 3: Parse relative dates ---');
  const relativeDates = ['now', 'today', 'tomorrow', 'yesterday', '3 days ago', 'in 5 days', '2 weeks ago', 'next Monday', 'last Friday'];
  for (const dateStr of relativeDates) {
    try {
      const result = await datetime.execute(
        { operation: 'parse', date: dateStr, timezone: 'America/New_York' },
        { toolCallId: `test-3-${dateStr}`, messages: [] }
      );
      if ('error' in result) {
        console.log(`  "${dateStr}": ERROR - ${result.error}`);
      } else {
        console.log(`  "${dateStr}": ${result.date} (${result.dayOfWeek})`);
      }
    } catch (error) {
      console.error(`  "${dateStr}": Failed -`, error);
    }
  }
  console.log();

  // Test 4: Date difference calculation
  console.log('--- Test 4: Calculate date differences ---');
  const datePairs = [
    { date1: 'today', date2: 'tomorrow' },
    { date1: '2024-01-01', date2: '2024-12-31' },
    { date1: '3 months ago', date2: 'today' },
    { date1: 'last Monday', date2: 'next Monday' },
  ];
  for (const { date1, date2 } of datePairs) {
    try {
      const result = await datetime.execute(
        { operation: 'difference', date1, date2 },
        { toolCallId: `test-4-${date1}-${date2}`, messages: [] }
      );
      if ('error' in result) {
        console.log(`  "${date1}" to "${date2}": ERROR - ${result.error}`);
      } else if ('difference' in result) {
        console.log(`  "${date1}" to "${date2}":`);
        console.log(`    Days: ${result.difference.days}, Weeks: ${result.difference.weeks}, Months: ${result.difference.months}`);
      }
    } catch (error) {
      console.error(`  "${date1}" to "${date2}": Failed -`, error);
    }
  }
  console.log();

  // Test 5: Convert between timezones
  console.log('--- Test 5: Timezone conversion ---');
  try {
    const result = await datetime.execute(
      { operation: 'convert', date: 'now', fromTimezone: 'America/New_York', toTimezone: 'Asia/Tokyo' },
      { toolCallId: 'test-5', messages: [] }
    );
    console.log('Converting "now" from New York to Tokyo:');
    console.log('Result:', JSON.stringify(result, null, 2));
    console.log();
  } catch (error) {
    console.error('Failed:', error);
  }

  // Test 6: Parse ISO dates
  console.log('--- Test 6: Parse ISO format dates ---');
  const isoDates = ['2024-06-15T14:30:00Z', '2024-12-25', '2025-01-01T00:00:00-05:00'];
  for (const dateStr of isoDates) {
    try {
      const result = await datetime.execute(
        { operation: 'parse', date: dateStr, timezone: 'UTC' },
        { toolCallId: `test-6-${dateStr}`, messages: [] }
      );
      if ('error' in result) {
        console.log(`  "${dateStr}": ERROR - ${result.error}`);
      } else {
        console.log(`  "${dateStr}": ${result.date} ${result.time} (${result.dayOfWeek})`);
      }
    } catch (error) {
      console.error(`  "${dateStr}": Failed -`, error);
    }
  }
  console.log();

  // Test 7: Invalid inputs
  console.log('--- Test 7: Error handling ---');
  const invalidInputs = [
    { operation: 'current' as const, timezone: 'Invalid/Timezone' },
    { operation: 'parse' as const, date: 'not a valid date' },
    { operation: 'difference' as const, date1: 'today' }, // missing date2
  ];
  for (const input of invalidInputs) {
    try {
      const result = await datetime.execute(input, { toolCallId: 'test-7', messages: [] });
      if ('error' in result) {
        console.log(`  Input ${JSON.stringify(input)}: Handled error - "${result.error}"`);
      } else {
        console.log(`  Input ${JSON.stringify(input)}: Unexpectedly succeeded`);
      }
    } catch (error) {
      console.error(`  Input ${JSON.stringify(input)}: Threw -`, error);
    }
  }
  console.log();

  console.log('=== All tests complete ===');
}

main().catch(console.error);
