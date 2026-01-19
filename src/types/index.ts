import type { Folder, Chat, Message, Connector, Settings, UserContext } from '@/generated/prisma';

// Re-export Prisma types for convenience
export type { Folder, Chat, Message, Connector, Settings, UserContext };

// Message roles
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

// Connector types
export type ConnectorType = 'aws' | 'github' | 'jira' | 'confluence' | 'jenkins' | 'outlook';

export const CONNECTOR_TYPES: ConnectorType[] = [
  'aws',
  'github',
  'jira',
  'confluence',
  'jenkins',
  'outlook',
];

// Folder with nested children and chats
export type FolderWithChildren = Folder & {
  children: FolderWithChildren[];
  chats: Chat[];
};

// Chat with messages
export type ChatWithMessages = Chat & {
  messages: Message[];
};

// Chat with folder info for listing
export type ChatWithFolder = Chat & {
  folder: Folder | null;
};

// Connector status for health checks
export interface ConnectorStatus {
  type: ConnectorType;
  name: string;
  enabled: boolean;
  healthy: boolean;
  lastHealthy: Date | null;
  error?: string;
}

// API request/response types

export interface CreateFolderRequest {
  name: string;
  parentId?: string | null;
}

export interface UpdateFolderRequest {
  name?: string;
  parentId?: string | null;
  sortOrder?: number;
}

export interface CreateChatRequest {
  title?: string;
  folderId?: string | null;
}

export interface UpdateChatRequest {
  title?: string;
  folderId?: string | null;
}

export interface CreateMessageRequest {
  role: MessageRole;
  content: string;
  toolCalls?: Record<string, unknown>[];
  toolName?: string;
}

export interface UpdateSettingsRequest {
  selectedModel?: string;
  systemPrompt?: string;
  sidebarCollapsed?: boolean;
}

export interface UpdateUserContextRequest {
  content: string;
}

// Available Anthropic models
export const ANTHROPIC_MODELS = [
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
  { id: 'claude-opus-4-20250514', name: 'Claude Opus 4' },
  { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
] as const;

export type AnthropicModelId = (typeof ANTHROPIC_MODELS)[number]['id'];
