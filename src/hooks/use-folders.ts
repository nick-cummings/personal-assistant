'use client';

import type { CreateFolderRequest, FolderWithChildren, UpdateFolderRequest } from '@/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const FOLDERS_KEY = ['folders'];

async function fetchFolders(): Promise<FolderWithChildren[]> {
  const res = await fetch('/api/folders');
  if (!res.ok) throw new Error('Failed to fetch folders');
  return res.json();
}

async function createFolder(data: CreateFolderRequest): Promise<FolderWithChildren> {
  const res = await fetch('/api/folders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create folder');
  return res.json();
}

async function updateFolder({
  id,
  ...data
}: UpdateFolderRequest & { id: string }): Promise<FolderWithChildren> {
  const res = await fetch(`/api/folders/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update folder');
  return res.json();
}

async function deleteFolder(id: string): Promise<void> {
  const res = await fetch(`/api/folders/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete folder');
}

export function useFolders() {
  return useQuery({
    queryKey: FOLDERS_KEY,
    queryFn: fetchFolders,
  });
}

export function useCreateFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createFolder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FOLDERS_KEY });
    },
  });
}

export function useUpdateFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateFolder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FOLDERS_KEY });
    },
  });
}

export function useDeleteFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteFolder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FOLDERS_KEY });
    },
  });
}
