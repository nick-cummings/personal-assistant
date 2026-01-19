'use client';

import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ChatWithMessages } from '@/types';

interface UseChatStreamOptions {
  chatId: string;
  onFinish?: () => void;
}

interface StreamingMessage {
  id: string;
  role: 'assistant';
  content: string;
  createdAt: Date;
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

        // toTextStreamResponse returns plain text chunks
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          accumulatedContent += chunk;
          setStreamingMessage((prev) => (prev ? { ...prev, content: accumulatedContent } : null));
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
