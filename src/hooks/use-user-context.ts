'use client';

import type { UpdateUserContextRequest, UserContext } from '@/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const CONTEXT_KEY = ['userContext'];

async function fetchUserContext(): Promise<UserContext> {
  const res = await fetch('/api/context');
  if (!res.ok) throw new Error('Failed to fetch user context');
  return res.json();
}

async function updateUserContext(data: UpdateUserContextRequest): Promise<UserContext> {
  const res = await fetch('/api/context', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update user context');
  return res.json();
}

export function useUserContext() {
  return useQuery({
    queryKey: CONTEXT_KEY,
    queryFn: fetchUserContext,
  });
}

export function useUpdateUserContext() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateUserContext,
    onSuccess: (data) => {
      queryClient.setQueryData(CONTEXT_KEY, data);
    },
  });
}
