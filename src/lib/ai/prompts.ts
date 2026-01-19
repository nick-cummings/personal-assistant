import { db } from '@/lib/db';

const BASE_SYSTEM_PROMPT = `You are a helpful AI assistant with access to the user's development and work tools. You can query AWS, GitHub, Jira, Confluence, Jenkins, and Outlook to help answer questions about deployments, code, tasks, documentation, and communications.

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

  // Add enabled connectors list
  if (connectors.length > 0) {
    const connectorList = connectors.map((c) => `- ${c.name} (${c.type})`).join('\n');
    parts.push(`\n## Available Connectors\n\n${connectorList}`);
  } else {
    parts.push(
      '\n## Available Connectors\n\nNo connectors are currently configured. You can help the user with general questions, but cannot access external tools.'
    );
  }

  return parts.join('\n');
}

// Generate a title for a chat based on the first message
export function generateTitlePrompt(firstMessage: string): string {
  return `Generate a short, descriptive title (3-6 words) for a chat that starts with this message. Return ONLY the title, no quotes or extra text.

Message: "${firstMessage}"`;
}
