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

// Represents either a text segment or a tool call in the stream
export type StreamPart =
  | { type: 'text'; content: string }
  | { type: 'tool-call'; toolCall: ToolCallInfo };

interface StreamingMessage {
  id: string;
  role: 'assistant';
  content: string;
  createdAt: Date;
  toolCalls: ToolCallInfo[];
  isToolRunning: boolean;
  // Ordered sequence of text and tool calls as they occurred
  parts: StreamPart[];
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
        parts: [],
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
        let parts: StreamPart[] = [];
        let currentTextSegment = ''; // Track current text segment separately
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
                  currentTextSegment += part.text;
                  // Update or add text part at the end
                  const lastPart = parts[parts.length - 1];
                  if (lastPart && lastPart.type === 'text') {
                    // Append to existing text part (use segment-specific content)
                    parts = [
                      ...parts.slice(0, -1),
                      { type: 'text', content: currentTextSegment },
                    ];
                  } else {
                    // Start a new text part
                    parts = [...parts, { type: 'text', content: currentTextSegment }];
                  }
                  setStreamingMessage((prev) =>
                    prev ? { ...prev, content: accumulatedContent, parts, isToolRunning: false } : null
                  );
                  break;

                case 'tool-input-start': {
                  // Tool is starting to be called - reset text segment for next text block
                  currentTextSegment = '';
                  const newToolCall: ToolCallInfo = {
                    id: part.id,
                    name: part.toolName,
                    args: {},
                    state: 'pending' as const,
                  };
                  toolCalls = [...toolCalls.filter((t) => t.id !== part.id), newToolCall];
                  // Add tool call to parts
                  parts = [...parts, { type: 'tool-call', toolCall: newToolCall }];
                  setStreamingMessage((prev) =>
                    prev ? { ...prev, toolCalls, parts, isToolRunning: true } : null
                  );
                  break;
                }

                case 'tool-call': {
                  // Tool call with full args (update existing or add)
                  const existingIdx = toolCalls.findIndex((t) => t.id === part.toolCallId);
                  const updatedToolCall: ToolCallInfo = {
                    id: part.toolCallId,
                    name: part.toolName,
                    args: part.args || {},
                    state: 'pending' as const,
                  };
                  if (existingIdx >= 0) {
                    toolCalls = toolCalls.map((t) =>
                      t.id === part.toolCallId ? updatedToolCall : t
                    );
                    // Update the tool call in parts too
                    parts = parts.map((p) =>
                      p.type === 'tool-call' && p.toolCall.id === part.toolCallId
                        ? { type: 'tool-call', toolCall: updatedToolCall }
                        : p
                    );
                  } else {
                    toolCalls = [...toolCalls, updatedToolCall];
                    parts = [...parts, { type: 'tool-call', toolCall: updatedToolCall }];
                  }
                  setStreamingMessage((prev) =>
                    prev ? { ...prev, toolCalls, parts, isToolRunning: true } : null
                  );
                  break;
                }

                case 'tool-result': {
                  // Tool finished with result
                  toolCalls = toolCalls.map((t) =>
                    t.id === part.toolCallId ? { ...t, state: 'result' as const } : t
                  );
                  // Update the tool call state in parts
                  parts = parts.map((p) =>
                    p.type === 'tool-call' && p.toolCall.id === part.toolCallId
                      ? { type: 'tool-call', toolCall: { ...p.toolCall, state: 'result' as const } }
                      : p
                  );
                  setStreamingMessage((prev) =>
                    prev
                      ? {
                          ...prev,
                          toolCalls,
                          parts,
                          isToolRunning: toolCalls.some((t) => t.state === 'pending'),
                        }
                      : null
                  );
                  break;
                }

                case 'tool-error': {
                  // Tool failed
                  toolCalls = toolCalls.map((t) =>
                    t.id === part.toolCallId ? { ...t, state: 'result' as const } : t
                  );
                  // Update the tool call state in parts
                  parts = parts.map((p) =>
                    p.type === 'tool-call' && p.toolCall.id === part.toolCallId
                      ? { type: 'tool-call', toolCall: { ...p.toolCall, state: 'result' as const } }
                      : p
                  );
                  setStreamingMessage((prev) =>
                    prev
                      ? {
                          ...prev,
                          toolCalls,
                          parts,
                          isToolRunning: toolCalls.some((t) => t.state === 'pending'),
                        }
                      : null
                  );
                  break;
                }

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
