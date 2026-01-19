import { tool } from 'ai';
import { z } from 'zod';
import type { GoogleCalendarClient } from './client';
import type { ToolSet } from '../types';

export function createGoogleCalendarTools(client: GoogleCalendarClient): ToolSet {
  return {
    google_calendar_list_calendars: tool({
      description: 'List all calendars the user has access to',
      inputSchema: z.object({}),
      execute: async () => {
        const calendars = await client.listCalendars();
        return {
          count: calendars.length,
          calendars: calendars.map((cal) => ({
            id: cal.id,
            name: cal.summary,
            description: cal.description,
            timeZone: cal.timeZone,
            primary: cal.primary,
          })),
        };
      },
    }),

    google_calendar_get_todays_events: tool({
      description: "Get today's events from a calendar",
      inputSchema: z.object({
        calendarId: z.string().optional().default('primary').describe('Calendar ID (default: primary)'),
      }),
      execute: async ({ calendarId }) => {
        const events = await client.getTodaysEvents(calendarId);
        return {
          count: events.length,
          events: events.map((event) => formatEvent(event)),
        };
      },
    }),

    google_calendar_get_upcoming: tool({
      description: 'Get upcoming events from a calendar',
      inputSchema: z.object({
        calendarId: z.string().optional().default('primary').describe('Calendar ID (default: primary)'),
        days: z.number().optional().default(7).describe('Number of days ahead to look'),
        maxResults: z.number().optional().default(50).describe('Maximum number of events'),
      }),
      execute: async ({ calendarId, days, maxResults }) => {
        const events = await client.getUpcomingEvents(calendarId, days, maxResults);
        return {
          count: events.length,
          events: events.map((event) => formatEvent(event)),
        };
      },
    }),

    google_calendar_search: tool({
      description: 'Search for events by keyword',
      inputSchema: z.object({
        query: z.string().describe('Search query'),
        calendarId: z.string().optional().default('primary').describe('Calendar ID (default: primary)'),
      }),
      execute: async ({ query, calendarId }) => {
        const events = await client.searchEvents(query, calendarId);
        return {
          count: events.length,
          events: events.map((event) => formatEvent(event)),
        };
      },
    }),

    google_calendar_get_event: tool({
      description: 'Get details of a specific calendar event',
      inputSchema: z.object({
        eventId: z.string().describe('The ID of the event'),
        calendarId: z.string().optional().default('primary').describe('Calendar ID (default: primary)'),
      }),
      execute: async ({ eventId, calendarId }) => {
        const event = await client.getEvent(calendarId, eventId);
        return formatEvent(event, true);
      },
    }),

    google_calendar_check_availability: tool({
      description: 'Check free/busy status for a time range',
      inputSchema: z.object({
        startTime: z.string().describe('Start time in ISO 8601 format'),
        endTime: z.string().describe('End time in ISO 8601 format'),
        calendarIds: z.array(z.string()).optional().default(['primary'])
          .describe('Calendar IDs to check (default: primary)'),
      }),
      execute: async ({ startTime, endTime, calendarIds }) => {
        const freeBusy = await client.getFreeBusy(startTime, endTime, calendarIds);
        return {
          timeRange: { start: startTime, end: endTime },
          calendars: Object.entries(freeBusy).map(([calId, data]) => ({
            calendarId: calId,
            busyPeriods: data.busy,
          })),
        };
      },
    }),
  };
}

function formatEvent(event: {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  status?: string;
  htmlLink?: string;
  organizer?: { email: string; displayName?: string };
  attendees?: Array<{ email: string; displayName?: string; responseStatus?: string }>;
  conferenceData?: { entryPoints?: Array<{ entryPointType: string; uri: string }> };
}, includeDetails: boolean = false) {
  const base = {
    id: event.id,
    title: event.summary || '(No title)',
    start: event.start.dateTime || event.start.date,
    end: event.end.dateTime || event.end.date,
    isAllDay: !event.start.dateTime,
    location: event.location,
    status: event.status,
    link: event.htmlLink,
  };

  if (!includeDetails) {
    return base;
  }

  return {
    ...base,
    description: event.description,
    organizer: event.organizer ? {
      name: event.organizer.displayName,
      email: event.organizer.email,
    } : undefined,
    attendees: event.attendees?.map((a) => ({
      name: a.displayName,
      email: a.email,
      status: a.responseStatus,
    })),
    meetingLink: event.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri,
  };
}
