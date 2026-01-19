'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Settings, UpdateSettingsRequest } from '@/types';

const SETTINGS_KEY = ['settings'];

async function fetchSettings(): Promise<Settings> {
  const res = await fetch('/api/settings');
  if (!res.ok) throw new Error('Failed to fetch settings');
  return res.json();
}

async function updateSettingsFn(data: UpdateSettingsRequest): Promise<Settings> {
  const res = await fetch('/api/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update settings');
  return res.json();
}

export function useSettings() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: fetchSettings,
  });

  const mutation = useMutation({
    mutationFn: updateSettingsFn,
    onSuccess: (data) => {
      queryClient.setQueryData(SETTINGS_KEY, data);
    },
  });

  return {
    ...query,
    updateSettings: mutation.mutate,
    isUpdating: mutation.isPending,
  };
}
