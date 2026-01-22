import {
    getAllConnectorMetadata, getConnectorMetadata, getEnabledConnectors
} from '@/lib/connectors';
import { db } from '@/lib/db';
import type { ConnectorType } from '@/types';

// Get today's date in a readable format
function getTodayDate(): string {
  const now = new Date();
  return now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// Build the base system prompt with current date
function getBaseSystemPrompt(): string {
  return `You are a helpful AI assistant with access to the user's development and work tools. Based on configured connectors, you can help with code repositories, project management, documentation, cloud infrastructure, emails, calendars, and file storage.

## Current Date

Today is ${getTodayDate()}. Use this date when interpreting relative time references like "last 30 days", "this week", "yesterday", etc. When filtering by date, calculate the actual date range based on today's date.

## Guidelines

1. **Use tools proactively** — When a question could be answered with real data, fetch it rather than speculating.

2. **Provide actionable links** — Always include direct links to relevant pages (Jira tickets, PRs, AWS console, etc.) so the user can take action.

3. **Summarize intelligently** — When fetching large amounts of data, summarize the key points and offer to dive deeper into specifics.

4. **Handle errors gracefully** — If a connector fails, explain what happened and suggest alternatives or manual steps.

5. **For write operations** — You cannot create, update, or delete resources. Instead, provide the user with:
   - A direct link to the appropriate page
   - Step-by-step instructions for what they need to do

6. **Cross-reference when helpful** — If a Jira ticket mentions a PR, or a deployment relates to a GitHub commit, connect the dots.

7. **Be concise but thorough** — Default to concise answers, but be comprehensive when the user asks for details.

8. **Expand search queries intelligently** — When searching emails, files, or other content, think about what terms would actually appear in the results. Use the "queries" parameter (array) to search for multiple related terms in a single tool call:
   - "Tax documents" → queries: ["1099", "W-2", "W-4", "1098", "tax form", "tax return", "tax statement", "IRS"]
   - "Receipts" → queries: ["receipt", "invoice", "order confirmation", "purchase confirmation"]
   - "Travel itinerary" → queries: ["flight", "booking", "reservation", "itinerary", "hotel", "airline"]
   - "Meeting notes" → queries: ["meeting notes", "minutes", "action items", "recap", "summary"]

9. **Use date filtering for time-based queries** — When users ask for emails from a specific time period (e.g., "last 30 days", "this month", "last week"), use the afterDate and beforeDate parameters to filter results:
   - "Last 30 days" → afterDate: (today - 30 days in ISO format)
   - "This month" → afterDate: first day of current month, beforeDate: first day of next month
   - "Yesterday" → afterDate: yesterday's date, beforeDate: today's date`;
}

export async function buildSystemPrompt(): Promise<string> {
  const [settings, userContext, enabledConnectors] = await Promise.all([
    db.settings.findUnique({ where: { id: 'singleton' } }),
    db.userContext.findUnique({ where: { id: 'singleton' } }),
    getEnabledConnectors(), // This checks both DB and environment variables
  ]);

  const parts: string[] = [getBaseSystemPrompt()];

  // Add user context if available
  if (userContext?.content) {
    parts.push(`\n## User Context\n\n${userContext.content}`);
  }

  // Add custom system prompt from settings if available
  if (settings?.systemPrompt) {
    parts.push(`\n## Additional Instructions\n\n${settings.systemPrompt}`);
  }

  // Add enabled connectors list with descriptions
  if (enabledConnectors.length > 0) {
    const connectorList = enabledConnectors
      .map((c) => {
        const metadata = getConnectorMetadata(c.type as ConnectorType);
        const description = metadata?.description || '';
        return `- **${c.name}** (${c.type})${description ? ` — ${description}` : ''}`;
      })
      .join('\n');
    parts.push(
      `\n## Available Connectors\n\nYou have access to ${enabledConnectors.length} configured connector(s). Use these tools to help the user:\n\n${connectorList}`
    );
  } else {
    // List available connector types that can be configured
    const allMetadata = getAllConnectorMetadata();
    const availableTypes = allMetadata.map((m) => `- **${m.name}** — ${m.description}`).join('\n');
    parts.push(
      `\n## Available Connectors\n\nNo connectors are currently configured. The following connectors can be set up in Settings → Connectors:\n\n${availableTypes}\n\nIMPORTANT: Only mention the connectors listed above. Do not suggest connectors that are not in this list (e.g., no GitLab, Linear, Notion, Slack, etc.).`
    );
  }

  // Add connector setup instructions so the assistant can help users configure connectors
  const allMetadata = getAllConnectorMetadata();
  const setupInstructionsSummary = allMetadata
    .map((m) => {
      // Extract key setup info from the full instructions
      const isOAuth =
        m.setupInstructions?.includes('Authorize the Connection') ||
        m.setupInstructions?.includes('OAuth') ||
        m.setupInstructions?.includes('/api/auth/');
      const hasApiToken =
        m.setupInstructions?.includes('API Token') ||
        m.setupInstructions?.includes('Personal Access Token');
      const hasServiceAccount = m.setupInstructions?.includes('Service Account');

      let authMethod = '';
      if (isOAuth) {
        authMethod = 'OAuth (requires app registration, then user authorization)';
      } else if (hasServiceAccount) {
        authMethod = 'Service Account credentials';
      } else if (hasApiToken) {
        authMethod = 'API Token/Personal Access Token';
      }

      const fields = m.configFields.map((f) => f.label).join(', ');
      return `- **${m.name}**: ${authMethod}. Required fields: ${fields}`;
    })
    .join('\n');

  parts.push(
    `\n## Connector Setup Reference\n\nWhen users ask about setting up connectors, use this information:\n\n${setupInstructionsSummary}\n\n**OAuth connectors** (Gmail, Yahoo Mail, Outlook, Google Drive, Google Docs, Google Sheets, Google Calendar): Users need to create an app/register in the respective developer console, enter the Client ID and Client Secret, save, then click "Connect" to complete the OAuth authorization flow.\n\n**API Token connectors** (GitHub, Jira, Confluence, Jenkins): Users generate a token from the service's settings and enter it directly.\n\n**Service Account connectors** (Google Cloud): Users create a service account and provide the JSON key credentials.\n\n**AWS**: Uses IAM access keys (Access Key ID + Secret Access Key).`
  );

  // Add generic tools section
  // Check both database settings and environment variables for API keys
  const hasSerpApiKey = !!(settings?.serpApiKey || process.env.SERP_API_KEY);
  const hasOpenWeatherApiKey = !!(settings?.openWeatherApiKey || process.env.OPEN_WEATHER_API_KEY);

  const genericToolsList: string[] = [];
  genericToolsList.push('- **calculator** — Evaluate math expressions and convert units');
  genericToolsList.push('- **datetime** — Get current time, convert timezones, calculate date differences');
  genericToolsList.push('- **web_fetch** — Read content from any URL (articles, documentation, web pages)');
  genericToolsList.push('- **npm** — Search npm packages, get package info, find GitHub repos for JS/TS libraries');

  if (hasSerpApiKey) {
    genericToolsList.push('- **web_search** — Search the web for current information');
  }
  if (hasOpenWeatherApiKey) {
    genericToolsList.push('- **weather** — Get current weather and forecasts for any location');
  }

  parts.push(
    `\n## General Tools\n\nYou always have access to these utility tools:\n\n${genericToolsList.join('\n')}${
      !hasSerpApiKey || !hasOpenWeatherApiKey
        ? '\n\n*Note: Additional tools (web_search, weather) can be enabled by adding API keys in Settings or environment variables.*'
        : ''
    }`
  );

  return parts.join('\n');
}

// Generate a title for a chat based on the first message
export function generateTitlePrompt(firstMessage: string): string {
  return `Generate a short, descriptive title (3-6 words) for a chat that starts with this message. Return ONLY the title, no quotes or extra text.

Message: "${firstMessage}"`;
}
