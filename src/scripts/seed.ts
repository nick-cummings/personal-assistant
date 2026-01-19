import { db as prisma } from '../lib/db';

const DEFAULT_CONTEXT = `# About Me

<!-- Edit this section with information about yourself -->
- Name:
- Role:
- Team:

# Key Identifiers

<!-- These help the AI find your stuff across services -->
- GitHub username:
- Jira assignee name:
- Email address:

# Projects & Repositories

<!-- List the repos, Jira projects, and AWS resources you work with most -->

# Preferences

<!-- How do you like responses? Any specific formatting preferences? -->
- Preferred response style: concise / detailed
- Timezone:
`;

async function main() {
  console.log('Seeding database...');

  // Create default settings
  await prisma.settings.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      selectedModel: 'claude-sonnet-4-20250514',
      systemPrompt: '',
      sidebarCollapsed: false,
    },
  });
  console.log('Created default settings');

  // Create default user context
  await prisma.userContext.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      content: DEFAULT_CONTEXT,
    },
  });
  console.log('Created default user context');

  // Create a sample folder structure
  const workFolder = await prisma.folder.upsert({
    where: { id: 'sample-work-folder' },
    update: {},
    create: {
      id: 'sample-work-folder',
      name: 'Work',
      sortOrder: 0,
    },
  });
  console.log('Created sample folder: Work');

  // Create a sample chat
  const sampleChat = await prisma.chat.upsert({
    where: { id: 'sample-chat' },
    update: {},
    create: {
      id: 'sample-chat',
      title: 'Getting Started',
      folderId: workFolder.id,
    },
  });
  console.log('Created sample chat: Getting Started');

  // Add a welcome message
  await prisma.message.upsert({
    where: { id: 'welcome-message' },
    update: {},
    create: {
      id: 'welcome-message',
      chatId: sampleChat.id,
      role: 'assistant',
      content: `Welcome to AI Chat Hub!

This is your AI-powered assistant with integrations for developer and work tools. Here's what you can do:

**Chat Features:**
- Create folders to organize your conversations
- Fork chats to branch off discussions
- Search across all your chats

**Coming Soon (Phase 2+):**
- AI-powered responses with Claude
- Connectors for AWS, GitHub, Jira, Confluence, Jenkins, and Outlook
- Rich link previews for tickets, PRs, and more

Get started by typing a message below or creating a new chat!`,
    },
  });
  console.log('Created welcome message');

  console.log('Seeding complete!');
}

main()
  .then(() => {
    console.log('Done');
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
