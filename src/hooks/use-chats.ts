'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  Chat,
  ChatWithMessages,
  ChatWithFolder,
  CreateChatRequest,
  UpdateChatRequest,
  CreateMessageRequest,
} from '@/types';

const CHATS_KEY = ['chats'];
const FOLDERS_KEY = ['folders'];

async function fetchChats(folderId?: string, archived?: boolean): Promise<ChatWithFolder[]> {
  const params = new URLSearchParams();
  if (folderId) params.set('folderId', folderId);
  if (archived) params.set('archived', 'true');
  const url = `/api/chats${params.toString() ? `?${params}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch chats');
  return res.json();
}

async function fetchChat(id: string): Promise<ChatWithMessages> {
  const res = await fetch(`/api/chats/${id}`);
  if (!res.ok) throw new Error('Failed to fetch chat');
  return res.json();
}

async function createChat(data: CreateChatRequest): Promise<ChatWithMessages> {
  const res = await fetch('/api/chats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create chat');
  return res.json();
}

async function updateChat({
  id,
  ...data
}: UpdateChatRequest & { id: string }): Promise<ChatWithMessages> {
  const res = await fetch(`/api/chats/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update chat');
  return res.json();
}

async function deleteChat(id: string): Promise<void> {
  const res = await fetch(`/api/chats/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete chat');
}

async function forkChat({
  id,
  title,
  folderId,
}: {
  id: string;
  title?: string;
  folderId?: string | null;
}): Promise<ChatWithMessages> {
  const res = await fetch(`/api/chats/${id}/fork`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, folderId }),
  });
  if (!res.ok) throw new Error('Failed to fork chat');
  return res.json();
}

async function addMessage({
  chatId,
  ...data
}: CreateMessageRequest & { chatId: string }): Promise<Chat> {
  const res = await fetch(`/api/chats/${chatId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to add message');
  return res.json();
}

export function useChats(folderId?: string, archived?: boolean) {
  return useQuery({
    queryKey: [...CHATS_KEY, { folderId, archived }],
    queryFn: () => fetchChats(folderId, archived),
  });
}

export function useArchivedChats() {
  return useQuery({
    queryKey: [...CHATS_KEY, 'archived'],
    queryFn: () => fetchChats(undefined, true),
  });
}

export function useChat(id: string | null) {
  return useQuery({
    queryKey: [...CHATS_KEY, id],
    queryFn: () => fetchChat(id!),
    enabled: !!id,
  });
}

export function useCreateChat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createChat,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHATS_KEY });
      queryClient.invalidateQueries({ queryKey: FOLDERS_KEY });
    },
  });
}

export function useUpdateChat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateChat,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: CHATS_KEY });
      queryClient.invalidateQueries({ queryKey: FOLDERS_KEY });
      queryClient.setQueryData([...CHATS_KEY, data.id], data);
    },
  });
}

export function useDeleteChat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteChat,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHATS_KEY });
      queryClient.invalidateQueries({ queryKey: FOLDERS_KEY });
    },
  });
}

export function useArchiveChat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      updateChat({ id, archived }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHATS_KEY });
      queryClient.invalidateQueries({ queryKey: FOLDERS_KEY });
    },
  });
}

export function useForkChat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: forkChat,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHATS_KEY });
      queryClient.invalidateQueries({ queryKey: FOLDERS_KEY });
    },
  });
}

export function useAddMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: addMessage,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [...CHATS_KEY, variables.chatId] });
    },
  });
}
