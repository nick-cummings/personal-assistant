import { db } from '@/lib/db';
import { getConnectorMetadata, getAllConnectorMetadata } from '@/lib/connectors';
import type { ConnectorType } from '@/types';

const BASE_SYSTEM_PROMPT = `You are a helpful AI assistant with access to the user's development and work tools. Based on configured connectors, you can help with code repositories, project management, documentation, cloud infrastructure, emails, calendars, and file storage.

## Guidelines

1. **Use tools proactively** — When a question could be answered with real data, fetch it rather than speculating.

2. **Provide actionable links** — Always include direct links to relevant pages (Jira tickets, PRs, AWS console, etc.) so the user can take action.

3. **Summarize intelligently** — When fetching large amounts of data, summarize the key points and offer to dive deeper into specifics.

4. **Handle errors gracefully** — If a connector fails, explain what happened and suggest alternatives or manual steps.

5. **For write operations** — You cannot create, update, or delete resources. Instead, provide the user with:
   - A direct link to the appropriate page
   - Step-by-step instructions for what they need to do

6. **Cross-reference when helpful** — If a Jira ticket mentions a PR, or a deployment relates to a GitHub commit, connect the dots.

7. **Be concise but thorough** — Default to concise answers, but be comprehensive when the user asks for details.`;

export async function buildSystemPrompt(): Promise<string> {
  const [settings, userContext, connectors] = await Promise.all([
    db.settings.findUnique({ where: { id: 'singleton' } }),
    db.userContext.findUnique({ where: { id: 'singleton' } }),
    db.connector.findMany({ where: { enabled: true } }),
  ]);

  const parts: string[] = [BASE_SYSTEM_PROMPT];

  // Add user context if available
  if (userContext?.content) {
    parts.push(`\n## User Context\n\n${userContext.content}`);
  }

  // Add custom system prompt from settings if available
  if (settings?.systemPrompt) {
    parts.push(`\n## Additional Instructions\n\n${settings.systemPrompt}`);
  }

  // Add enabled connectors list with descriptions
  if (connectors.length > 0) {
    const connectorList = connectors.map((c) => {
      const metadata = getConnectorMetadata(c.type as ConnectorType);
      const description = metadata?.description || '';
      return `- **${c.name}** (${c.type})${description ? ` — ${description}` : ''}`;
    }).join('\n');
    parts.push(`\n## Available Connectors\n\nYou have access to ${connectors.length} configured connector(s). Use these tools to help the user:\n\n${connectorList}`);
  } else {
    // List available connector types that can be configured
    const allMetadata = getAllConnectorMetadata();
    const availableTypes = allMetadata
      .map((m) => `- **${m.name}** — ${m.description}`)
      .join('\n');
    parts.push(
      `\n## Available Connectors\n\nNo connectors are currently configured. The following connectors can be set up in Settings → Connectors:\n\n${availableTypes}\n\nIMPORTANT: Only mention the connectors listed above. Do not suggest connectors that are not in this list (e.g., no GitLab, Linear, Notion, Slack, etc.).`
    );
  }

  return parts.join('\n');
}

// Generate a title for a chat based on the first message
export function generateTitlePrompt(firstMessage: string): string {
  return `Generate a short, descriptive title (3-6 words) for a chat that starts with this message. Return ONLY the title, no quotes or extra text.

Message: "${firstMessage}"`;
}
