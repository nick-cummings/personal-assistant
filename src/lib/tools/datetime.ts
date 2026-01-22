import { tool } from 'ai';
import { z } from 'zod';
import type { ToolSet } from '../connectors/types';

// Common timezone aliases
const timezoneAliases: Record<string, string> = {
  // US timezones
  est: 'America/New_York',
  edt: 'America/New_York',
  eastern: 'America/New_York',
  cst: 'America/Chicago',
  cdt: 'America/Chicago',
  central: 'America/Chicago',
  mst: 'America/Denver',
  mdt: 'America/Denver',
  mountain: 'America/Denver',
  pst: 'America/Los_Angeles',
  pdt: 'America/Los_Angeles',
  pacific: 'America/Los_Angeles',
  // Other common
  utc: 'UTC',
  gmt: 'Europe/London',
  bst: 'Europe/London',
  cet: 'Europe/Paris',
  cest: 'Europe/Paris',
  jst: 'Asia/Tokyo',
  ist: 'Asia/Kolkata',
  aest: 'Australia/Sydney',
  aedt: 'Australia/Sydney',
};

function resolveTimezone(tz: string): string {
  const lower = tz.toLowerCase();
  return timezoneAliases[lower] || tz;
}

function formatDateTime(date: Date, timezone: string): {
  iso: string;
  date: string;
  time: string;
  dayOfWeek: string;
  timezone: string;
  offset: string;
} {
  const resolved = resolveTimezone(timezone);

  try {
    const options: Intl.DateTimeFormatOptions = {
      timeZone: resolved,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    };

    const formatter = new Intl.DateTimeFormat('en-US', options);
    const parts = formatter.formatToParts(date);

    const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '';

    const dateStr = `${getPart('month')} ${getPart('day')}, ${getPart('year')}`;
    const timeStr = `${getPart('hour')}:${getPart('minute')}:${getPart('second')} ${getPart('dayPeriod')}`;

    // Get offset
    const offsetFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: resolved,
      timeZoneName: 'shortOffset',
    });
    const offsetParts = offsetFormatter.formatToParts(date);
    const offset = offsetParts.find((p) => p.type === 'timeZoneName')?.value || '';

    return {
      iso: date.toISOString(),
      date: dateStr,
      time: timeStr,
      dayOfWeek: getPart('weekday'),
      timezone: resolved,
      offset,
    };
  } catch {
    throw new Error(`Invalid timezone: ${timezone}`);
  }
}

function parseDateInput(input: string): Date {
  // Handle relative dates
  const lower = input.toLowerCase().trim();
  const now = new Date();

  if (lower === 'now' || lower === 'today') {
    return now;
  }

  if (lower === 'tomorrow') {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  }

  if (lower === 'yesterday') {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday;
  }

  // Handle "X days/weeks/months ago" or "in X days/weeks/months"
  const relativeMatch = lower.match(/^(in\s+)?(\d+)\s+(day|week|month|year)s?\s*(ago)?$/);
  if (relativeMatch) {
    const [, inPrefix, amount, unit, ago] = relativeMatch;
    const num = parseInt(amount, 10);
    const multiplier = inPrefix ? 1 : ago ? -1 : 1;
    const result = new Date(now);

    switch (unit) {
      case 'day':
        result.setDate(result.getDate() + num * multiplier);
        break;
      case 'week':
        result.setDate(result.getDate() + num * 7 * multiplier);
        break;
      case 'month':
        result.setMonth(result.getMonth() + num * multiplier);
        break;
      case 'year':
        result.setFullYear(result.getFullYear() + num * multiplier);
        break;
    }
    return result;
  }

  // Handle "next Monday", "last Friday", etc.
  const dayMatch = lower.match(/^(next|last)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/);
  if (dayMatch) {
    const [, direction, dayName] = dayMatch;
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const targetDay = days.indexOf(dayName);
    const currentDay = now.getDay();
    const result = new Date(now);

    let diff = targetDay - currentDay;
    if (direction === 'next') {
      if (diff <= 0) diff += 7;
    } else {
      if (diff >= 0) diff -= 7;
    }
    result.setDate(result.getDate() + diff);
    return result;
  }

  // Try parsing as a date string
  const parsed = new Date(input);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  throw new Error(`Could not parse date: "${input}"`);
}

export function createDateTimeTool(): ToolSet {
  const datetime = tool({
    description:
      'Get current date/time information, convert between timezones, calculate date differences, or parse relative dates. Supports natural language inputs like "tomorrow", "next Monday", "3 days ago".',
    inputSchema: z.object({
      operation: z
        .enum(['current', 'convert', 'difference', 'parse'])
        .default('current')
        .describe(
          'Operation to perform: "current" for current time, "convert" for timezone conversion, "difference" for days between dates, "parse" for parsing a date string'
        ),
      timezone: z
        .string()
        .optional()
        .default('UTC')
        .describe(
          'Timezone for the result (e.g., "America/New_York", "PST", "UTC", "Asia/Tokyo"). Supports common abbreviations.'
        ),
      date: z
        .string()
        .optional()
        .describe(
          'Date to parse or convert. Supports ISO format, relative terms ("tomorrow", "next Monday", "3 days ago"), or natural dates.'
        ),
      fromTimezone: z
        .string()
        .optional()
        .describe('Source timezone for conversion (default: UTC)'),
      toTimezone: z
        .string()
        .optional()
        .describe('Target timezone for conversion'),
      date1: z
        .string()
        .optional()
        .describe('First date for difference calculation'),
      date2: z
        .string()
        .optional()
        .describe('Second date for difference calculation'),
    }),
    execute: async ({ operation, timezone, date, fromTimezone, toTimezone, date1, date2 }) => {
      console.log(`[DateTime ${new Date().toISOString()}] Operation: ${operation}`, {
        timezone,
        date,
        fromTimezone,
        toTimezone,
        date1,
        date2,
      });

      try {
        switch (operation) {
          case 'current': {
            const now = new Date();
            const formatted = formatDateTime(now, timezone);
            return {
              operation: 'current',
              ...formatted,
              unixTimestamp: Math.floor(now.getTime() / 1000),
            };
          }

          case 'convert': {
            if (!date) {
              return { error: 'Please provide a date to convert' };
            }
            const sourceDate = parseDateInput(date);
            const targetTz = toTimezone || timezone;
            const formatted = formatDateTime(sourceDate, targetTz);
            return {
              operation: 'convert',
              input: date,
              ...formatted,
            };
          }

          case 'difference': {
            if (!date1 || !date2) {
              return { error: 'Please provide both date1 and date2 for difference calculation' };
            }
            const d1 = parseDateInput(date1);
            const d2 = parseDateInput(date2);
            const diffMs = d2.getTime() - d1.getTime();
            const diffDays = diffMs / (1000 * 60 * 60 * 24);
            const diffWeeks = diffDays / 7;
            const diffMonths = diffDays / 30.44; // Average days per month
            const diffYears = diffDays / 365.25;

            return {
              operation: 'difference',
              date1: {
                input: date1,
                parsed: d1.toISOString(),
              },
              date2: {
                input: date2,
                parsed: d2.toISOString(),
              },
              difference: {
                days: Math.round(diffDays * 100) / 100,
                weeks: Math.round(diffWeeks * 100) / 100,
                months: Math.round(diffMonths * 100) / 100,
                years: Math.round(diffYears * 100) / 100,
              },
            };
          }

          case 'parse': {
            if (!date) {
              return { error: 'Please provide a date to parse' };
            }
            const parsed = parseDateInput(date);
            const formatted = formatDateTime(parsed, timezone);
            return {
              operation: 'parse',
              input: date,
              ...formatted,
              unixTimestamp: Math.floor(parsed.getTime() / 1000),
            };
          }

          default:
            return { error: `Unknown operation: ${operation}` };
        }
      } catch (error) {
        console.error(`[DateTime ${new Date().toISOString()}] Error:`, error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return { error: message };
      }
    },
  });

  return { datetime };
}
