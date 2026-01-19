'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, X, Loader2, Plug, Settings2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { LoadingSpinner } from '@/components/shared/loading-spinner';
import {
  useConnectors,
  useConnector,
  useUpdateConnector,
  useDeleteConnector,
  useTestConnector,
  type ConnectorListItem,
} from '@/hooks/use-connectors';
import type { ConnectorType } from '@/types';

export default function ConnectorsPage() {
  const { data: connectors, isLoading } = useConnectors();
  const [selectedType, setSelectedType] = useState<ConnectorType | null>(null);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex items-center gap-4 border-b px-6 py-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" asChild>
                <Link href="/settings">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Back to Settings</TooltipContent>
          </Tooltip>
          <div>
            <h1 className="text-xl font-semibold">Connectors</h1>
            <p className="text-muted-foreground text-sm">
              Connect to external services to give the AI access to your tools
            </p>
          </div>
        </div>

        {/* Connector List */}
        <div className="flex-1 overflow-auto p-6">
          <div className="mx-auto max-w-2xl space-y-4">
            {connectors?.map((connector) => (
              <ConnectorCard
                key={connector.type}
                connector={connector}
                onConfigure={() => setSelectedType(connector.type)}
              />
            ))}
          </div>
        </div>

        {/* Configuration Dialog */}
        {selectedType && (
          <ConnectorConfigDialog
            type={selectedType}
            open={!!selectedType}
            onClose={() => setSelectedType(null)}
          />
        )}
      </div>
    </TooltipProvider>
  );
}

function ConnectorCard({
  connector,
  onConfigure,
}: {
  connector: ConnectorListItem;
  onConfigure: () => void;
}) {
  const updateConnector = useUpdateConnector();
  const testConnector = useTestConnector();
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);

  const handleToggle = (enabled: boolean) => {
    if (connector.configured) {
      updateConnector.mutate({
        type: connector.type,
        config: {},
        enabled,
      });
    }
  };

  const handleTest = async () => {
    setTestResult(null);
    const result = await testConnector.mutateAsync(connector.type);
    setTestResult(result);
    // Clear result after 5 seconds
    setTimeout(() => setTestResult(null), 5000);
  };

  return (
    <div className="flex items-center gap-4 rounded-lg border p-4">
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-lg ${
          connector.configured && connector.enabled ? 'bg-primary/10' : 'bg-muted'
        }`}
      >
        <Plug
          className={`h-6 w-6 ${
            connector.configured && connector.enabled ? 'text-primary' : 'text-muted-foreground'
          }`}
        />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h3 className="font-medium">{connector.name}</h3>
          {connector.configured && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                connector.enabled
                  ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                  : 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
              }`}
            >
              {connector.enabled ? 'Enabled' : 'Disabled'}
            </span>
          )}
        </div>
        <p className="text-muted-foreground text-sm">{connector.description}</p>
        {connector.lastHealthy && (
          <p className="text-muted-foreground mt-1 text-xs">
            Last verified: {new Date(connector.lastHealthy).toLocaleDateString()}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {connector.configured && (
          <>
            {testResult && (
              <span
                className={`text-xs ${testResult.success ? 'text-green-600' : 'text-red-600'}`}
              >
                {testResult.success ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Tooltip>
                    <TooltipTrigger>
                      <X className="h-4 w-4" />
                    </TooltipTrigger>
                    <TooltipContent>{testResult.error}</TooltipContent>
                  </Tooltip>
                )}
              </span>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleTest}
                  disabled={testConnector.isPending}
                >
                  {testConnector.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Test'
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Test connection</TooltipContent>
            </Tooltip>
            <Switch
              checked={connector.enabled}
              onCheckedChange={handleToggle}
              disabled={updateConnector.isPending}
            />
          </>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="sm" onClick={onConfigure}>
              <Settings2 className="mr-2 h-4 w-4" />
              {connector.configured ? 'Edit' : 'Configure'}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {connector.configured ? 'Edit configuration' : 'Set up connector'}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

function ConnectorConfigDialog({
  type,
  open,
  onClose,
}: {
  type: ConnectorType;
  open: boolean;
  onClose: () => void;
}) {
  const { data: connector, isLoading } = useConnector(type);
  const updateConnector = useUpdateConnector();
  const deleteConnector = useDeleteConnector();
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  // Initialize form when connector data loads
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      onClose();
      setFormData({});
      setError(null);
    }
  };

  // Update form when connector loads
  if (connector && Object.keys(formData).length === 0) {
    setFormData(connector.config);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      await updateConnector.mutateAsync({
        type,
        config: formData,
        enabled: true,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  const handleDelete = async () => {
    if (confirm('Are you sure you want to remove this connector?')) {
      await deleteConnector.mutateAsync(type);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configure {connector?.name}</DialogTitle>
          <DialogDescription>{connector?.description}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              {connector?.configFields.map((field) => (
                <div key={field.key} className="space-y-2">
                  <label htmlFor={field.key} className="text-sm font-medium">
                    {field.label}
                    {field.required && <span className="text-destructive ml-1">*</span>}
                  </label>
                  <Input
                    id={field.key}
                    type={field.type === 'password' ? 'password' : 'text'}
                    placeholder={field.placeholder}
                    value={formData[field.key] || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                    required={field.required}
                  />
                  {field.helpText && (
                    <p className="text-muted-foreground text-xs">{field.helpText}</p>
                  )}
                </div>
              ))}

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-row">
              {connector?.configured && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleteConnector.isPending}
                  className="w-full sm:w-auto"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remove
                </Button>
              )}
              <div className="flex flex-1 justify-end gap-2">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateConnector.isPending}>
                  {updateConnector.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Save
                </Button>
              </div>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
