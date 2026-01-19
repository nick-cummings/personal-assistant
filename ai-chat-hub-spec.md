# AI Chat Hub — Project Specification v1.0

> A locally-run Next.js application providing an AI chat interface with deep integrations into developer/work tools.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Tech Stack](#tech-stack)
4. [Data Model](#data-model)
5. [Connector Specifications](#connector-specifications)
6. [API Routes](#api-routes)
7. [UI Components](#ui-components)
8. [System Prompt](#system-prompt)
9. [User Context Document](#user-context-document)
10. [Project Structure](#project-structure)
11. [Environment Variables](#environment-variables)
12. [Implementation Order](#implementation-order)
13. [Future Enhancements](#future-enhancements)

---

## Overview

### Purpose

An AI-powered chat application that connects to developer and work tools (AWS, GitHub, Jira, Confluence, Jenkins, Outlook) to provide a unified interface for querying deployment status, code reviews, tasks, documentation, and communications.

### Key Features (v1)

- AI chat with streaming responses
- Folder/subfolder organization for chats
- Fork chat functionality (copy history to new chat)
- Shared user context across all chats
- Connectors for AWS, GitHub, Jira, Confluence, Jenkins, Outlook
- Response caching with background loading
- Collapsible sidebar
- Model selection (Anthropic models only)
- Auto-generated chat titles with rename option
- Mobile-responsive design

### Design Decisions

- **Read-only operations** — No write operations to external services. For writes, the AI provides links and instructions.
- **Single account per connector** — Multi-account support deferred to future version.
- **Global shared context** — All chats share the same user context document. Isolated chats deferred to future version.
- **Single global system prompt** — Folder-specific prompts deferred to future version.
- **Local-first** — SQLite database, credentials in .env or encrypted in DB. Hosted version deferred.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Next.js App                              │
├─────────────────────────────────────────────────────────────────┤
│  UI Layer                                                       │
│  ┌─────────────┐ ┌─────────────────────────────────────────┐   │
│  │  Sidebar    │ │  Chat Interface                         │   │
│  │  - Folders  │ │  - Message list (streaming)             │   │
│  │  - Chats    │ │  - Input bar                            │   │
│  │  - Search   │ │  - Rich link previews                   │   │
│  │  - Settings │ │  - Tool call indicators                 │   │
│  └─────────────┘ └─────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  API Layer (Route Handlers)                                     │
│  /api/chat      - Streaming chat completions                    │
│  /api/folders   - Folder CRUD                                   │
│  /api/chats     - Chat CRUD, search                             │
│  /api/context   - User context document                         │
│  /api/connectors - Connector config & health                    │
├─────────────────────────────────────────────────────────────────┤
│  Service Layer                                                  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐    │
│  │  AI Service  │ │  Connector   │ │  Cache Service       │    │
│  │  - Claude    │ │  Registry    │ │  - Response cache    │    │
│  │  - Tools     │ │  - AWS       │ │  - TTL management    │    │
│  │  - Streaming │ │  - GitHub    │ │  - Background load   │    │
│  │              │ │  - Jira      │ │                      │    │
│  │              │ │  - Confluence│ │                      │    │
│  │              │ │  - Jenkins   │ │                      │    │
│  │              │ │  - Outlook   │ │                      │    │
│  └──────────────┘ └──────────────┘ └──────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  Data Layer (SQLite + Prisma)                                   │
│  - Folders, Chats, Messages                                     │
│  - Connector configs (encrypted)                                │
│  - Response cache                                               │
│  - User context document                                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer            | Technology                  |
| ---------------- | --------------------------- |
| Framework        | Next.js 14+ (App Router)    |
| Language         | TypeScript                  |
| Styling          | Tailwind CSS + shadcn/ui    |
| State Management | Zustand                     |
| Database         | SQLite                      |
| ORM              | Prisma                      |
| AI               | Anthropic Claude API        |
| Auth (Outlook)   | OAuth 2.0 (Microsoft Graph) |

---

## Data Model

### Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

model Folder {
  id        String   @id @default(cuid())
  name      String
  parentId  String?
  parent    Folder?  @relation("FolderTree", fields: [parentId], references: [id], onDelete: Cascade)
  children  Folder[] @relation("FolderTree")
  chats     Chat[]
  sortOrder Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Chat {
  id        String    @id @default(cuid())
  title     String
  folderId  String?
  folder    Folder?   @relation(fields: [folderId], references: [id], onDelete: SetNull)
  messages  Message[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}

model Message {
  id        String   @id @default(cuid())
  chatId    String
  chat      Chat     @relation(fields: [chatId], references: [id], onDelete: Cascade)
  role      String   // 'user' | 'assistant' | 'system' | 'tool'
  content   String   // Text content or JSON for tool results
  toolCalls Json?    // Array of tool calls made by assistant
  toolName  String?  // For tool role messages, which tool produced this
  createdAt DateTime @default(now())
}

model Connector {
  id           String        @id @default(cuid())
  type         String        // 'aws' | 'github' | 'jira' | 'confluence' | 'jenkins' | 'outlook'
  name         String        // User-friendly name
  config       String        // Encrypted JSON blob
  enabled      Boolean       @default(true)
  lastHealthy  DateTime?
  cachedData   CachedData[]
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt

  @@unique([type]) // One connector per type for v1
}

model CachedData {
  id          String    @id @default(cuid())
  connectorId String
  connector   Connector @relation(fields: [connectorId], references: [id], onDelete: Cascade)
  cacheKey    String    // e.g., "jira:assigned_issues" or "github:open_prs"
  data        String    // JSON blob
  expiresAt   DateTime
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@unique([connectorId, cacheKey])
  @@index([expiresAt])
}

model UserContext {
  id        String   @id @default("singleton") // Single row
  content   String   // Markdown document
  updatedAt DateTime @updatedAt
}

model Settings {
  id              String   @id @default("singleton")
  selectedModel   String   @default("claude-sonnet-4-20250514")
  systemPrompt    String   @default("")
  sidebarCollapsed Boolean @default(false)
  updatedAt       DateTime @updatedAt
}
```

---

## Connector Specifications

### Shared Interface

```typescript
interface Connector {
  id: string;
  type: ConnectorType;

  // Metadata for AI tool definitions
  getTools(): ToolDefinition[];

  // Execute a tool call
  executeTool(toolName: string, params: Record<string, unknown>): Promise<ToolResult>;

  // Health check / auth validation
  testConnection(): Promise<{ success: boolean; error?: string }>;
}

type ConnectorType = 'aws' | 'github' | 'jira' | 'confluence' | 'jenkins' | 'outlook';
```

### AWS Connector

| Tool                        | Description                       | Parameters                                                          |
| --------------------------- | --------------------------------- | ------------------------------------------------------------------- |
| `aws_list_log_groups`       | List CloudWatch log groups        | `prefix?`                                                           |
| `aws_search_logs`           | Search CloudWatch logs            | `logGroupName`, `filterPattern`, `startTime?`, `endTime?`, `limit?` |
| `aws_get_pipeline_status`   | Get CodePipeline execution status | `pipelineName`                                                      |
| `aws_list_pipelines`        | List all CodePipelines            | —                                                                   |
| `aws_get_build_status`      | Get CodeBuild project status      | `projectName`, `limit?`                                             |
| `aws_describe_ecs_services` | Get ECS service status            | `clusterName`, `serviceName?`                                       |
| `aws_get_lambda_status`     | Get Lambda function details       | `functionName`                                                      |

**Auth:** Access Key + Secret Access Key (or assume role)

### GitHub Connector

| Tool                       | Description              | Parameters                               |
| -------------------------- | ------------------------ | ---------------------------------------- |
| `github_list_prs`          | List pull requests       | `repo`, `state?`, `author?`              |
| `github_get_pr`            | Get PR details           | `repo`, `prNumber`                       |
| `github_get_pr_comments`   | Get PR comments/reviews  | `repo`, `prNumber`                       |
| `github_list_actions_runs` | List workflow runs       | `repo`, `workflow?`, `status?`, `limit?` |
| `github_get_actions_run`   | Get workflow run details | `repo`, `runId`                          |
| `github_search_issues`     | Search issues/PRs        | `query`                                  |

**Auth:** Personal Access Token

### Jira Connector

| Tool                      | Description            | Parameters      |
| ------------------------- | ---------------------- | --------------- |
| `jira_search_issues`      | Search with JQL        | `jql`, `limit?` |
| `jira_get_issue`          | Get issue details      | `issueKey`      |
| `jira_get_issue_comments` | Get issue comments     | `issueKey`      |
| `jira_get_sprint`         | Get active sprint info | `boardId`       |
| `jira_list_boards`        | List available boards  | —               |

**Auth:** API Token + Email

### Confluence Connector

| Tool                           | Description            | Parameters                     |
| ------------------------------ | ---------------------- | ------------------------------ |
| `confluence_search`            | Search pages/content   | `query`, `spaceKey?`, `limit?` |
| `confluence_get_page`          | Get page content       | `pageId`                       |
| `confluence_list_spaces`       | List accessible spaces | —                              |
| `confluence_get_page_children` | Get child pages        | `pageId`                       |

**Auth:** API Token + Email (often same as Jira)

### Jenkins Connector

| Tool                     | Description              | Parameters                        |
| ------------------------ | ------------------------ | --------------------------------- |
| `jenkins_list_jobs`      | List all jobs            | `folder?`                         |
| `jenkins_get_job_status` | Get job status           | `jobName`                         |
| `jenkins_get_build`      | Get build details        | `jobName`, `buildNumber`          |
| `jenkins_get_build_log`  | Get build console output | `jobName`, `buildNumber`, `tail?` |

**Auth:** API Token + Username

### Outlook Connector

| Tool                          | Description         | Parameters                   |
| ----------------------------- | ------------------- | ---------------------------- |
| `outlook_search_emails`       | Search emails       | `query`, `folder?`, `limit?` |
| `outlook_get_email`           | Get email details   | `messageId`                  |
| `outlook_list_folders`        | List mail folders   | —                            |
| `outlook_get_calendar_events` | Get calendar events | `startDate`, `endDate`       |

**Auth:** OAuth 2.0 (Microsoft Graph API)

---

## API Routes

| Route                         | Method | Description                           |
| ----------------------------- | ------ | ------------------------------------- |
| `/api/chat`                   | POST   | Stream chat completion                |
| `/api/chats`                  | GET    | List all chats (with folder info)     |
| `/api/chats`                  | POST   | Create new chat                       |
| `/api/chats/[id]`             | GET    | Get chat with messages                |
| `/api/chats/[id]`             | PATCH  | Update chat (title, folder)           |
| `/api/chats/[id]`             | DELETE | Delete chat                           |
| `/api/chats/[id]/fork`        | POST   | Fork chat (copy messages to new chat) |
| `/api/chats/search`           | GET    | Full-text search across messages      |
| `/api/folders`                | GET    | List folders (tree structure)         |
| `/api/folders`                | POST   | Create folder                         |
| `/api/folders/[id]`           | PATCH  | Update folder (name, parent, order)   |
| `/api/folders/[id]`           | DELETE | Delete folder                         |
| `/api/context`                | GET    | Get user context document             |
| `/api/context`                | PUT    | Update user context document          |
| `/api/connectors`             | GET    | List connectors with status           |
| `/api/connectors/[type]`      | GET    | Get connector config                  |
| `/api/connectors/[type]`      | PUT    | Update connector config               |
| `/api/connectors/[type]/test` | POST   | Test connector connection             |
| `/api/settings`               | GET    | Get app settings                      |
| `/api/settings`               | PATCH  | Update app settings                   |

---

## UI Components

### Sidebar (Collapsible)

```
┌────────────────────────┐
│ [≡] AI Chat Hub   [+]  │  <- Collapse btn, New chat btn
├────────────────────────┤
│ 🔍 Search chats...     │
├────────────────────────┤
│ 📁 Work                │
│   └─ 📁 Project Alpha  │
│        ├─ 💬 Deploy Q  │
│        └─ 💬 Sprint 12 │
│   └─ 💬 Daily standup  │
│ 📁 Personal            │
│ 💬 Unfiled chat        │
├────────────────────────┤
│ ⚙️ Settings            │
│ 📋 My Context          │
│ 🔌 Connectors          │
└────────────────────────┘
```

### Chat Interface

```
┌─────────────────────────────────────────────────────────────────┐
│ Sprint 12 Planning [✏️ rename] [🔀 fork]          Model: [▼]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  You                                                  10:30 AM  │
│  What's the status of my Jira tickets?                          │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Assistant                                            10:30 AM  │
│  🔧 Calling jira_search_issues...                               │
│                                                                 │
│  You have 5 tickets assigned:                                   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 🎫 PROJ-123 — Fix auth timeout                          │   │
│  │ Status: In Progress │ Priority: High                    │   │
│  │ [Open in Jira →]                                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ...                                                            │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ [📎] Type a message...                             [Send ➤]     │
└─────────────────────────────────────────────────────────────────┘
```

### Component Hierarchy

```
components/
├── ui/                        # shadcn components
├── chat/
│   ├── chat-interface.tsx     # Main chat container
│   ├── message-list.tsx       # Scrollable message container
│   ├── message-bubble.tsx     # Individual message display
│   ├── tool-call-indicator.tsx # Shows when AI is calling tools
│   ├── rich-link-card.tsx     # Jira/GitHub/etc link previews
│   └── chat-input.tsx         # Input bar with send button
├── sidebar/
│   ├── sidebar.tsx            # Collapsible container
│   ├── folder-tree.tsx        # Recursive folder/chat tree
│   ├── chat-list-item.tsx     # Individual chat in tree
│   └── search-input.tsx       # Chat search
├── settings/
│   ├── connector-card.tsx     # Single connector status/config
│   ├── connector-config-modal.tsx # Credential entry modal
│   └── context-editor.tsx     # Markdown editor for user context
└── shared/
    ├── model-selector.tsx     # Anthropic model dropdown
    └── loading-spinner.tsx
```

---

## System Prompt

```markdown
You are a helpful AI assistant with access to the user's development and work tools. You can query AWS, GitHub, Jira, Confluence, Jenkins, and Outlook to help answer questions about deployments, code, tasks, documentation, and communications.

## User Context

{userContextDocument}

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

## Available Connectors

{enabledConnectorsList}
```

---

## User Context Document

### Default Template

```markdown
# About Me

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
```

---

## Project Structure

```
ai-chat-hub/
├── src/
│   ├── app/
│   │   ├── layout.tsx                 # Root layout with providers
│   │   ├── page.tsx                   # Redirect to /chat or last chat
│   │   ├── chat/
│   │   │   ├── layout.tsx             # Chat layout with sidebar
│   │   │   ├── page.tsx               # New chat / empty state
│   │   │   └── [chatId]/
│   │   │       └── page.tsx           # Chat view
│   │   ├── settings/
│   │   │   ├── page.tsx               # General settings
│   │   │   ├── connectors/
│   │   │   │   └── page.tsx           # Connector management
│   │   │   └── context/
│   │   │       └── page.tsx           # User context editor
│   │   └── api/
│   │       ├── chat/
│   │       │   └── route.ts           # POST: streaming completion
│   │       ├── chats/
│   │       │   ├── route.ts           # GET, POST
│   │       │   ├── search/
│   │       │   │   └── route.ts       # GET: search
│   │       │   └── [id]/
│   │       │       ├── route.ts       # GET, PATCH, DELETE
│   │       │       └── fork/
│   │       │           └── route.ts   # POST: fork chat
│   │       ├── folders/
│   │       │   ├── route.ts           # GET, POST
│   │       │   └── [id]/
│   │       │       └── route.ts       # PATCH, DELETE
│   │       ├── context/
│   │       │   └── route.ts           # GET, PUT
│   │       ├── connectors/
│   │       │   ├── route.ts           # GET: list all
│   │       │   └── [type]/
│   │       │       ├── route.ts       # GET, PUT
│   │       │       └── test/
│   │       │           └── route.ts   # POST: test connection
│   │       └── settings/
│   │           └── route.ts           # GET, PATCH
│   ├── components/
│   │   ├── ui/                        # shadcn components
│   │   ├── chat/
│   │   │   ├── chat-interface.tsx
│   │   │   ├── message-list.tsx
│   │   │   ├── message-bubble.tsx
│   │   │   ├── tool-call-indicator.tsx
│   │   │   ├── rich-link-card.tsx
│   │   │   └── chat-input.tsx
│   │   ├── sidebar/
│   │   │   ├── sidebar.tsx
│   │   │   ├── folder-tree.tsx
│   │   │   ├── chat-list-item.tsx
│   │   │   └── search-input.tsx
│   │   ├── settings/
│   │   │   ├── connector-card.tsx
│   │   │   ├── connector-config-modal.tsx
│   │   │   └── context-editor.tsx
│   │   └── shared/
│   │       ├── model-selector.tsx
│   │       └── loading-spinner.tsx
│   ├── lib/
│   │   ├── ai/
│   │   │   ├── client.ts              # Anthropic SDK setup
│   │   │   ├── tools.ts               # Tool definitions & execution
│   │   │   ├── stream.ts              # Streaming response handler
│   │   │   └── prompts.ts             # System prompt builder
│   │   ├── connectors/
│   │   │   ├── types.ts               # Shared interfaces
│   │   │   ├── registry.ts            # Connector registration
│   │   │   ├── aws/
│   │   │   │   ├── client.ts
│   │   │   │   ├── tools.ts
│   │   │   │   └── index.ts
│   │   │   ├── github/
│   │   │   │   ├── client.ts
│   │   │   │   ├── tools.ts
│   │   │   │   └── index.ts
│   │   │   ├── jira/
│   │   │   │   ├── client.ts
│   │   │   │   ├── tools.ts
│   │   │   │   └── index.ts
│   │   │   ├── confluence/
│   │   │   │   ├── client.ts
│   │   │   │   ├── tools.ts
│   │   │   │   └── index.ts
│   │   │   ├── jenkins/
│   │   │   │   ├── client.ts
│   │   │   │   ├── tools.ts
│   │   │   │   └── index.ts
│   │   │   └── outlook/
│   │   │       ├── client.ts
│   │   │       ├── tools.ts
│   │   │       └── index.ts
│   │   ├── db/
│   │   │   ├── client.ts              # Prisma client
│   │   │   └── queries.ts             # Common queries
│   │   ├── cache/
│   │   │   └── service.ts             # Cache read/write/invalidate
│   │   └── utils/
│   │       ├── crypto.ts              # Credential encryption
│   │       └── links.ts               # URL builders for services
│   ├── hooks/
│   │   ├── use-chat.ts                # Chat state & streaming
│   │   ├── use-folders.ts             # Folder tree state
│   │   ├── use-sidebar.ts             # Sidebar collapse state
│   │   └── use-connectors.ts          # Connector status
│   ├── stores/
│   │   └── app-store.ts               # Zustand global store
│   └── types/
│       └── index.ts                   # Shared TypeScript types
├── prisma/
│   ├── schema.prisma
│   └── seed.ts                        # Default data seeding
├── public/
├── .env.example
├── .env.local                         # Gitignored
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.js
└── README.md
```

---

## Environment Variables

### .env.example

```bash
# AI
ANTHROPIC_API_KEY=sk-ant-...

# Encryption (generate with: openssl rand -base64 32)
ENCRYPTION_KEY=your-32-byte-base64-key

# AWS (optional — can also configure in UI)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1

# GitHub (optional)
GITHUB_TOKEN=ghp_...
GITHUB_DEFAULT_OWNER=your-org

# Jira (optional)
JIRA_HOST=your-company.atlassian.net
JIRA_EMAIL=your-email@company.com
JIRA_API_TOKEN=

# Confluence (optional — often same as Jira)
CONFLUENCE_HOST=your-company.atlassian.net
CONFLUENCE_EMAIL=your-email@company.com
CONFLUENCE_API_TOKEN=

# Jenkins (optional)
JENKINS_URL=https://jenkins.your-company.com
JENKINS_USER=
JENKINS_API_TOKEN=

# Outlook (optional — requires Azure AD app registration)
OUTLOOK_CLIENT_ID=
OUTLOOK_CLIENT_SECRET=
OUTLOOK_TENANT_ID=
OUTLOOK_REDIRECT_URI=http://localhost:3000/api/auth/outlook/callback
```

---

## Implementation Order

### Week 1: Foundation

1. Project setup (Next.js, Prisma, Tailwind, shadcn)
2. Database schema and migrations
3. Basic layout with collapsible sidebar shell
4. Folder and chat CRUD (API + UI)
5. Basic chat interface (no AI yet, just message display)

### Week 2: AI Core

6. Anthropic client integration
7. Streaming chat completion
8. Chat title auto-generation
9. User context document (storage + editor)
10. System prompt builder

### Week 3: First Connectors

11. Connector framework (interface, registry, encryption)
12. GitHub connector (good first choice — straightforward API)
13. Jira connector
14. Connector settings UI

### Week 4: Remaining Connectors + Polish

15. AWS connector
16. Confluence connector
17. Jenkins connector
18. Outlook connector (most complex due to OAuth)
19. Rich link cards in chat
20. Chat search and fork functionality

### Week 5: Caching + Refinement

21. Response caching layer
22. Background cache loading on chat open
23. Error handling polish
24. Mobile responsiveness pass
25. Documentation (README, setup guide)

---

## Future Enhancements

### Phase 2: Enhanced Usability

- Pin important chats or messages
- Export chat to Markdown
- Keyboard shortcuts (new chat, search, navigation)
- Dark/light theme toggle
- Connector health dashboard
- Quick actions panel / command palette (⌘K)

### Phase 3: Intelligence Upgrades

- RAG pipeline for Confluence docs
- RAG pipeline for codebase (chunked by file/function)
- "Morning briefing" — auto-generated summary of overnight activity
- Scheduled queries ("alert me if any prod builds fail")
- Cross-connector correlation ("show me PRs related to this Jira ticket")
- Chat templates for common workflows

### Phase 4: Production Readiness

- OAuth flows for Outlook (and optionally others)
- Credential vault integration (1Password CLI, AWS Secrets Manager, etc.)
- User authentication (for multi-user hosting)
- Audit logging
- Docker deployment with proper secrets handling
- Multi-account support per connector
- Folder-specific system prompts
- Isolated chats (context not shared)
