# AI Chat Hub

A locally-run Next.js application providing an AI chat interface with deep integrations into developer and work tools.

## Features

- **AI Chat** - Streaming responses powered by Anthropic Claude
- **Folder Organization** - Organize chats in folders and subfolders
- **Fork Chat** - Copy message history to a new conversation
- **Shared Context** - Personal context document shared across all chats
- **13 Connectors** - Integrate with AWS, GitHub, Jira, Confluence, Jenkins, Outlook, Gmail, Yahoo Mail, Google Drive, Google Docs, Google Sheets, Google Calendar, and Google Cloud
- **Response Caching** - TTL-based caching with background preloading
- **Command Palette** - Quick actions with ⌘K
- **Keyboard Shortcuts** - Navigate efficiently
- **Dark/Light Mode** - Theme toggle with system preference support
- **Mobile Responsive** - Full mobile support with slide-out sidebar

## Quick Start

### Prerequisites

- Node.js 18+
- npm or pnpm

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd personal-assistant

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Add your Anthropic API key to .env
# ANTHROPIC_API_KEY=sk-ant-...

# Generate encryption key
openssl rand -base64 32
# Add to .env as ENCRYPTION_KEY

# Set up the database
npm run db:generate
npm run db:push
npm run db:seed

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to start chatting.

## Environment Variables

Create a `.env` file with the following:

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...
ENCRYPTION_KEY=<32-byte-base64-key>

# Database
DATABASE_URL=file:./dev.db

# Optional - Configure connectors via UI instead
# AWS
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1

# GitHub
GITHUB_TOKEN=ghp_...
GITHUB_DEFAULT_OWNER=your-org

# Jira
JIRA_HOST=your-company.atlassian.net
JIRA_EMAIL=your-email@company.com
JIRA_API_TOKEN=

# Confluence
CONFLUENCE_HOST=your-company.atlassian.net
CONFLUENCE_EMAIL=your-email@company.com
CONFLUENCE_API_TOKEN=

# Jenkins
JENKINS_URL=https://jenkins.your-company.com
JENKINS_USER=
JENKINS_API_TOKEN=

# Outlook (Azure AD App)
OUTLOOK_CLIENT_ID=
OUTLOOK_CLIENT_SECRET=
OUTLOOK_TENANT_ID=

# Gmail (Google Cloud Console)
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=

# Yahoo Mail
YAHOO_CLIENT_ID=
YAHOO_CLIENT_SECRET=

# Google Drive
GOOGLE_DRIVE_CLIENT_ID=
GOOGLE_DRIVE_CLIENT_SECRET=

# Google Docs
GOOGLE_DOCS_CLIENT_ID=
GOOGLE_DOCS_CLIENT_SECRET=

# Google Sheets
GOOGLE_SHEETS_CLIENT_ID=
GOOGLE_SHEETS_CLIENT_SECRET=

# Google Calendar
GOOGLE_CALENDAR_CLIENT_ID=
GOOGLE_CALENDAR_CLIENT_SECRET=

# Google Cloud (Service Account)
GOOGLE_CLOUD_PROJECT_ID=
GOOGLE_CLOUD_CLIENT_EMAIL=
GOOGLE_CLOUD_PRIVATE_KEY=
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| ⌘K | Open command palette |
| ⌘N | New chat |
| ⌘B | Toggle sidebar |
| ⌘, | Open settings |
| ⌘/ | Focus search |
| Esc | Close dialogs |

## Connector Setup

### OAuth Connectors (Gmail, Yahoo, Outlook, Google Suite)

1. Navigate to Settings → Connectors
2. Click on the connector you want to configure
3. Enter your OAuth credentials (Client ID, Client Secret)
4. Click "Connect" to start the OAuth flow
5. Authorize access in the popup window

### API Key Connectors (GitHub, Jira, Confluence, Jenkins, AWS)

1. Navigate to Settings → Connectors
2. Click on the connector you want to configure
3. Enter your API credentials
4. Click "Save" and then "Test Connection"

### Google Cloud (Service Account)

1. Create a service account in Google Cloud Console
2. Download the JSON key file
3. Enter the Project ID, Client Email, and Private Key in the connector settings

## Project Structure

```
src/
├── app/                  # Next.js App Router
│   ├── api/             # API routes
│   ├── chat/            # Chat pages
│   └── settings/        # Settings pages
├── components/          # React components
│   ├── chat/           # Chat UI components
│   ├── settings/       # Settings components
│   ├── shared/         # Shared components
│   ├── sidebar/        # Sidebar components
│   └── ui/             # shadcn/ui components
├── hooks/              # React hooks
├── lib/
│   ├── ai/             # Anthropic client
│   ├── cache/          # Caching service
│   ├── connectors/     # Connector implementations
│   └── utils/          # Utility functions
├── stores/             # Zustand stores
└── types/              # TypeScript types
```

## Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema to database
npm run db:studio    # Open Prisma Studio
npm run db:seed      # Seed database with defaults
```

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **State**: Zustand + TanStack Query
- **Database**: SQLite + Prisma
- **AI**: Anthropic Claude via Vercel AI SDK

## License

MIT
