'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ConnectorType } from '@/types';

const CONNECTORS_KEY = ['connectors'];

export interface ConnectorListItem {
  type: ConnectorType;
  name: string;
  description: string;
  configured: boolean;
  enabled: boolean;
  lastHealthy: string | null;
}

export interface ConfigField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url' | 'email';
  placeholder?: string;
  required: boolean;
  helpText?: string;
}

export interface ConnectorDetails {
  type: ConnectorType;
  name: string;
  description: string;
  configFields: ConfigField[];
  configured: boolean;
  enabled: boolean;
  config: Record<string, string>;
}

export interface ConnectionTestResult {
  success: boolean;
  error?: string;
}

async function fetchConnectors(): Promise<ConnectorListItem[]> {
  const res = await fetch('/api/connectors');
  if (!res.ok) throw new Error('Failed to fetch connectors');
  return res.json();
}

async function fetchConnector(type: ConnectorType): Promise<ConnectorDetails> {
  const res = await fetch(`/api/connectors/${type}`);
  if (!res.ok) throw new Error('Failed to fetch connector');
  return res.json();
}

async function updateConnector({
  type,
  config,
  enabled,
}: {
  type: ConnectorType;
  config: Record<string, string>;
  enabled?: boolean;
}): Promise<{ type: string; name: string; configured: boolean; enabled: boolean }> {
  const res = await fetch(`/api/connectors/${type}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config, enabled }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to update connector');
  }
  return res.json();
}

async function deleteConnector(type: ConnectorType): Promise<void> {
  const res = await fetch(`/api/connectors/${type}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete connector');
}

async function testConnector(type: ConnectorType): Promise<ConnectionTestResult> {
  const res = await fetch(`/api/connectors/${type}/test`, {
    method: 'POST',
  });
  return res.json();
}

export function useConnectors() {
  return useQuery({
    queryKey: CONNECTORS_KEY,
    queryFn: fetchConnectors,
  });
}

export function useConnector(type: ConnectorType | null) {
  return useQuery({
    queryKey: [...CONNECTORS_KEY, type],
    queryFn: () => fetchConnector(type!),
    enabled: !!type,
  });
}

export function useUpdateConnector() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateConnector,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: CONNECTORS_KEY });
      queryClient.invalidateQueries({ queryKey: [...CONNECTORS_KEY, variables.type] });
    },
  });
}

export function useDeleteConnector() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteConnector,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONNECTORS_KEY });
    },
  });
}

export function useTestConnector() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: testConnector,
    onSuccess: () => {
      // Refresh connector list to update lastHealthy
      queryClient.invalidateQueries({ queryKey: CONNECTORS_KEY });
    },
  });
}
