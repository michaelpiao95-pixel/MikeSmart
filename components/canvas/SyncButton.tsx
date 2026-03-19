"use client";

import { useState } from "react";
import { RefreshCw, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { SyncResult } from "@/types";

interface SyncButtonProps {
  lastSyncedAt?: string | null;
  onSyncComplete?: (result: SyncResult) => void;
}

export function SyncButton({ lastSyncedAt, onSyncComplete }: SyncButtonProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleSync = async () => {
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/canvas/sync", { method: "POST" });
      const json = await res.json();

      if (!res.ok) {
        setResult({ ok: false, message: json.error ?? "Sync failed" });
        return;
      }

      const data = json.data as SyncResult;
      setResult({
        ok: true,
        message: `+${data.assignmentsAdded} new, ${data.assignmentsUpdated} updated`,
      });
      onSyncComplete?.(data);
    } catch (err) {
      setResult({ ok: false, message: "Network error" });
    } finally {
      setLoading(false);
      // Clear result after 4s
      setTimeout(() => setResult(null), 4000);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {/* Status message */}
      {result && (
        <div
          className={cn(
            "flex items-center gap-1.5 text-sm animate-fade-in",
            result.ok ? "text-emerald-400" : "text-red-400"
          )}
        >
          {result.ok ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          {result.message}
        </div>
      )}

      {!result && lastSyncedAt && (
        <span className="text-xs text-muted-foreground">
          Synced {formatRelativeTime(lastSyncedAt)}
        </span>
      )}

      <Button
        onClick={handleSync}
        disabled={loading}
        variant="secondary"
        size="sm"
      >
        <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
        {loading ? "Syncing..." : "Sync Canvas"}
      </Button>
    </div>
  );
}
