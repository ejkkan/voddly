"use client";

import { Key, Lock, Timer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { usePassphrase } from "~/hooks/usePassphrase";

export function PassphraseCacheStatus() {
  const {
    getCachedAccountIds,
    getCacheTimeRemaining,
    removeCachedPassphrase,
    clearAllCachedPassphrases,
  } = usePassphrase();

  const cachedAccountIds = getCachedAccountIds();

  const formatTimeRemaining = (seconds: number): string => {
    if (seconds <= 0) return "Expired";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  if (cachedAccountIds.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="flex items-center gap-2 text-gray-600">
          <Lock className="h-4 w-4" />
          <span className="text-sm">No cached passphrases</span>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Passphrases will be cached for 5 minutes after first use
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-green-200 bg-green-50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-green-700">
          <Key className="h-4 w-4" />
          <span className="text-sm font-medium">
            Cached Passphrases ({cachedAccountIds.length})
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            clearAllCachedPassphrases();
            toast.success("All cached passphrases cleared");
          }}
          className="h-7 px-2 text-xs"
        >
          <Trash2 className="mr-1 h-3 w-3" />
          Clear All
        </Button>
      </div>

      <div className="space-y-2">
        {cachedAccountIds.map((accountId) => {
          const timeRemaining = getCacheTimeRemaining(accountId);
          return (
            <div
              key={accountId}
              className="flex items-center justify-between rounded border bg-white p-2"
            >
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                <span className="font-mono text-sm text-gray-700">
                  {accountId.slice(0, 8)}...
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Timer className="h-3 w-3" />
                  {formatTimeRemaining(timeRemaining)}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    removeCachedPassphrase(accountId);
                    toast.success("Passphrase cleared from cache");
                  }}
                  className="h-6 w-6 p-0"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-2 text-xs text-green-600">
        ✓ Passphrases are automatically cleared after 5 minutes
      </p>
    </div>
  );
}
