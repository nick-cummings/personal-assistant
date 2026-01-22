'use client';

import { LoadingSpinner } from '@/components/shared/loading-spinner';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
    useConnector, useConnectors, useDeleteConnector,
    useTestConnector, useUpdateConnector, type ConnectorListItem
} from '@/hooks/use-connectors';
import type { ConnectorType } from '@/types';
import { ArrowLeft, Check, ExternalLink, Loader2, Plug, Settings2, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

// OAuth-based connectors that need a "Connect" button after saving credentials
const OAUTH_CONNECTORS: ConnectorType[] = [
  'outlook',
  'google-drive',
  'google-docs',
  'google-sheets',
  'google-calendar',
];

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
            Last verified: {new Date(connector.lastHealthy).toLocaleString()}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3">
        {connector.configured && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTest}
                  disabled={testConnector.isPending}
                  className="gap-1.5"
                >
                  {testConnector.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : testResult ? (
                    testResult.success ? (
                      <Check className="h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <X className="h-3.5 w-3.5 text-red-600" />
                    )
                  ) : null}
                  Test
                </Button>
              </TooltipTrigger>
              <TooltipContent>{testResult?.error || 'Test connection'}</TooltipContent>
            </Tooltip>
            <div className="bg-border h-6 w-px" />
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
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form when connector data loads
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      onClose();
      setFormData({});
      setInitialized(false);
      setError(null);
    }
  };

  // Update form when connector loads - using useEffect to avoid render loop
  useEffect(() => {
    if (connector && !initialized) {
      setFormData(connector.config);
      setInitialized(true);
    }
  }, [connector, initialized]);

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

  const isOAuthConnector = OAUTH_CONNECTORS.includes(type);
  const oauthUrl = `/api/auth/${type}`;

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

              {isOAuthConnector && connector?.configured && (
                <div className="rounded-md border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    <strong>Step 2:</strong> After saving your credentials, click
                    &quot;Connect&quot; below to authorize access to your account.
                  </p>
                </div>
              )}

              {error && <p className="text-destructive text-sm">{error}</p>}
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
                {isOAuthConnector && connector?.configured && (
                  <Button type="button" variant="secondary" asChild>
                    <a href={oauthUrl}>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Connect
                    </a>
                  </Button>
                )}
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
