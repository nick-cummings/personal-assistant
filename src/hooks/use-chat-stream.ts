'use client';

import type { ChatWithMessages } from '@/types';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

interface UseChatStreamOptions {
  chatId: string;
  onFinish?: () => void;
}

export interface ToolCallInfo {
  id: string;
  name: string;
  args: Record<string, unknown>;
  state: 'pending' | 'result';
}

interface StreamingMessage {
  id: string;
  role: 'assistant';
  content: string;
  createdAt: Date;
  toolCalls: ToolCallInfo[];
  isToolRunning: boolean;
}

export function useChatStream({ chatId, onFinish }: UseChatStreamOptions) {
  const queryClient = useQueryClient();
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<StreamingMessage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      setIsStreaming(true);
      setError(null);

      // Optimistically add user message to the cache
      const optimisticUserMessage = {
        id: `optimistic-${Date.now()}`,
        chatId,
        role: 'user' as const,
        content,
        createdAt: new Date(),
        toolCalls: null,
        toolName: null,
      };

      queryClient.setQueryData<ChatWithMessages>(['chats', chatId], (oldData) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          messages: [...oldData.messages, optimisticUserMessage],
        };
      });

      setStreamingMessage({
        id: 'streaming',
        role: 'assistant',
        content: '',
        createdAt: new Date(),
        toolCalls: [],
        isToolRunning: false,
      });

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId, message: content }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to send message');
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let accumulatedContent = '';
        let toolCalls: ToolCallInfo[] = [];
        let buffer = '';

        // Parse newline-delimited JSON events from fullStream
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (!line.trim()) continue;

            try {
              const part = JSON.parse(line);

              switch (part.type) {
                case 'text-delta':
                  accumulatedContent += part.text;
                  setStreamingMessage((prev) =>
                    prev ? { ...prev, content: accumulatedContent, isToolRunning: false } : null
                  );
                  break;

                case 'tool-input-start':
                  // Tool is starting to be called
                  toolCalls = [
                    ...toolCalls.filter((t) => t.id !== part.id),
                    {
                      id: part.id,
                      name: part.toolName,
                      args: {},
                      state: 'pending' as const,
                    },
                  ];
                  setStreamingMessage((prev) =>
                    prev ? { ...prev, toolCalls, isToolRunning: true } : null
                  );
                  break;

                case 'tool-call':
                  // Tool call with full args (update existing or add)
                  const existingIdx = toolCalls.findIndex((t) => t.id === part.toolCallId);
                  if (existingIdx >= 0) {
                    toolCalls = toolCalls.map((t) =>
                      t.id === part.toolCallId ? { ...t, args: part.args } : t
                    );
                  } else {
                    toolCalls = [
                      ...toolCalls,
                      {
                        id: part.toolCallId,
                        name: part.toolName,
                        args: part.args || {},
                        state: 'pending' as const,
                      },
                    ];
                  }
                  setStreamingMessage((prev) =>
                    prev ? { ...prev, toolCalls, isToolRunning: true } : null
                  );
                  break;

                case 'tool-result':
                  // Tool finished with result
                  toolCalls = toolCalls.map((t) =>
                    t.id === part.toolCallId ? { ...t, state: 'result' as const } : t
                  );
                  setStreamingMessage((prev) =>
                    prev
                      ? {
                          ...prev,
                          toolCalls,
                          isToolRunning: toolCalls.some((t) => t.state === 'pending'),
                        }
                      : null
                  );
                  break;

                case 'tool-error':
                  // Tool failed
                  toolCalls = toolCalls.map((t) =>
                    t.id === part.toolCallId ? { ...t, state: 'result' as const } : t
                  );
                  setStreamingMessage((prev) =>
                    prev
                      ? {
                          ...prev,
                          toolCalls,
                          isToolRunning: toolCalls.some((t) => t.state === 'pending'),
                        }
                      : null
                  );
                  break;

                case 'error':
                  throw new Error(part.error || 'Stream error');

                // Ignore other event types (start-step, finish-step, etc.)
              }
            } catch (parseError) {
              // Ignore parse errors for incomplete or unknown events
              console.debug('Parse error for stream event:', parseError);
            }
          }
        }

        // Invalidate the chat query to refresh with saved messages
        await queryClient.invalidateQueries({ queryKey: ['chats', chatId] });

        // Also invalidate folders to update the chat title if it changed
        await queryClient.invalidateQueries({ queryKey: ['folders'] });

        onFinish?.();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An error occurred';
        setError(errorMessage);
        console.error('Chat stream error:', err);
      } finally {
        setIsStreaming(false);
        setStreamingMessage(null);
      }
    },
    [chatId, queryClient, onFinish]
  );

  return {
    sendMessage,
    isStreaming,
    streamingMessage,
    error,
  };
}
