'use client';

import type { UpdateUserContextRequest, UserContext } from '@/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const CONTEXT_KEY = ['context'];

async function fetchContext(): Promise<UserContext> {
  const res = await fetch('/api/context');
  if (!res.ok) throw new Error('Failed to fetch context');
  return res.json();
}

async function updateContextFn(data: UpdateUserContextRequest): Promise<UserContext> {
  const res = await fetch('/api/context', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update context');
  return res.json();
}

export function useContext() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: CONTEXT_KEY,
    queryFn: fetchContext,
  });

  const mutation = useMutation({
    mutationFn: updateContextFn,
    onSuccess: (data) => {
      queryClient.setQueryData(CONTEXT_KEY, data);
    },
  });

  return {
    ...query,
    updateContext: mutation.mutate,
    updateContextAsync: mutation.mutateAsync,
    isUpdating: mutation.isPending,
  };
}
