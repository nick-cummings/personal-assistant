'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useConnectors, useTestConnector } from '@/hooks/use-connectors';
import { cn } from '@/lib/utils';
import type { ConnectorType } from '@/types';
import { AlertCircle, CheckCircle2, Clock, Loader2, RefreshCw } from 'lucide-react';
import { useState } from 'react';

interface ConnectorStatus {
  type: string;
  name: string;
  enabled: boolean;
  lastHealthy: string | null;
  status: 'healthy' | 'unhealthy' | 'unknown' | 'testing';
}

function getStatusInfo(connector: { enabled: boolean; lastHealthy: string | null }) {
  if (!connector.enabled) {
    return {
      status: 'disabled' as const,
      icon: AlertCircle,
      color: 'text-muted-foreground',
      bgColor: 'bg-muted',
      label: 'Disabled',
    };
  }

  if (!connector.lastHealthy) {
    return {
      status: 'unknown' as const,
      icon: AlertCircle,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
      label: 'Not tested',
    };
  }

  const lastHealthy = new Date(connector.lastHealthy);
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);

  if (lastHealthy > hourAgo) {
    return {
      status: 'healthy' as const,
      icon: CheckCircle2,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      label: 'Healthy',
    };
  }

  return {
    status: 'stale' as const,
    icon: Clock,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    label: 'Stale',
  };
}

function formatLastHealthy(dateString: string | null): string {
  if (!dateString) return 'Never tested';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

interface ConnectorCardProps {
  connector: {
    type: string;
    name: string;
    enabled: boolean;
    lastHealthy: string | null;
  };
  onTest: () => void;
  isTesting: boolean;
}

function ConnectorHealthCard({ connector, onTest, isTesting }: ConnectorCardProps) {
  const statusInfo = getStatusInfo(connector);
  const StatusIcon = statusInfo.icon;

  return (
    <div
      className={cn('flex items-center justify-between rounded-lg border p-4', statusInfo.bgColor)}
    >
      <div className="flex items-center gap-3">
        <div className={cn('rounded-full p-2', statusInfo.bgColor)}>
          {isTesting ? (
            <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
          ) : (
            <StatusIcon className={cn('h-5 w-5', statusInfo.color)} />
          )}
        </div>
        <div>
          <div className="font-medium">{connector.name}</div>
          <div className="text-muted-foreground text-sm">
            {connector.enabled ? formatLastHealthy(connector.lastHealthy) : 'Disabled'}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className={cn(
            'text-xs',
            statusInfo.status === 'healthy' && 'border-green-500 text-green-500',
            statusInfo.status === 'stale' && 'border-yellow-500 text-yellow-500',
            statusInfo.status === 'unknown' && 'border-yellow-500 text-yellow-500',
            statusInfo.status === 'disabled' && 'border-muted-foreground text-muted-foreground'
          )}
        >
          {statusInfo.label}
        </Badge>
        {connector.enabled && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onTest}
            disabled={isTesting}
          >
            <RefreshCw className={cn('h-4 w-4', isTesting && 'animate-spin')} />
          </Button>
        )}
      </div>
    </div>
  );
}

export function ConnectorHealthDashboard() {
  const { data: connectors, isLoading } = useConnectors();
  const testConnector = useTestConnector();
  const [testingConnectors, setTestingConnectors] = useState<Set<string>>(new Set());

  const handleTestConnector = async (type: ConnectorType) => {
    setTestingConnectors((prev) => new Set(prev).add(type));
    try {
      await testConnector.mutateAsync(type);
    } finally {
      setTestingConnectors((prev) => {
        const next = new Set(prev);
        next.delete(type);
        return next;
      });
    }
  };

  const handleTestAll = async () => {
    const enabledConnectors = connectors?.filter((c) => c.enabled) || [];
    for (const connector of enabledConnectors) {
      await handleTestConnector(connector.type);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Connector Health</CardTitle>
          <CardDescription>Loading connector status...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const enabledConnectors = connectors?.filter((c) => c.enabled) || [];
  const disabledConnectors = connectors?.filter((c) => !c.enabled) || [];
  const healthyCount = enabledConnectors.filter((c) => {
    const info = getStatusInfo(c);
    return info.status === 'healthy';
  }).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Connector Health</CardTitle>
            <CardDescription>
              {enabledConnectors.length > 0
                ? `${healthyCount}/${enabledConnectors.length} connectors healthy`
                : 'No connectors enabled'}
            </CardDescription>
          </div>
          {enabledConnectors.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestAll}
              disabled={testingConnectors.size > 0}
            >
              <RefreshCw
                className={cn('mr-2 h-4 w-4', testingConnectors.size > 0 && 'animate-spin')}
              />
              Test All
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {enabledConnectors.length === 0 && disabledConnectors.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">
            No connectors configured. Add connectors in Settings → Connectors.
          </p>
        ) : (
          <>
            {enabledConnectors.map((connector) => (
              <ConnectorHealthCard
                key={connector.type}
                connector={connector}
                onTest={() => handleTestConnector(connector.type)}
                isTesting={testingConnectors.has(connector.type)}
              />
            ))}
            {disabledConnectors.length > 0 && enabledConnectors.length > 0 && (
              <div className="border-t pt-2">
                <p className="text-muted-foreground mb-2 text-xs">
                  Disabled ({disabledConnectors.length})
                </p>
                {disabledConnectors.map((connector) => (
                  <ConnectorHealthCard
                    key={connector.type}
                    connector={connector}
                    onTest={() => {}}
                    isTesting={false}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
