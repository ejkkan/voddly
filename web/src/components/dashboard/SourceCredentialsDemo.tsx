"use client";

import { Play } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { useSourceCredentials } from "~/hooks/useSourceCredentials";

interface Props {
  sourceId: string;
  sourceName: string;
}

export function SourceCredentialsDemo({ sourceId, sourceName }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const { getCredentials, getSourceInfo, prepareContentPlayback } =
    useSourceCredentials();

  const handleTestCredentials = async () => {
    setIsLoading(true);
    try {
      // Example: Get just the credentials
      const credentials = await getCredentials(sourceId, {
        title: "Test Credentials",
        message: `Testing credentials for ${sourceName}`,
      });

      toast.success("Credentials retrieved successfully!", {
        description: `Server: ${credentials.server}`,
      });
    } catch (error) {
      toast.error("Failed to get credentials");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestSourceInfo = async () => {
    setIsLoading(true);
    try {
      // Example: Get source info without prompting for passphrase
      const sourceInfo = await getSourceInfo(sourceId);

      toast.success("Source info retrieved!", {
        description: `Account: ${sourceInfo.account.name}`,
      });
    } catch (error) {
      toast.error("Failed to get source info");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestPlayback = async () => {
    setIsLoading(true);
    try {
      // Example: Prepare for content playback
      const playbackData = await prepareContentPlayback(
        sourceId,
        "12345", // Mock content ID
        "movie",
      );

      toast.success("Playback prepared!", {
        description: `Ready to play content ID: ${playbackData.contentId}`,
      });
    } catch (error) {
      toast.error("Failed to prepare playback");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
      <h3 className="mb-3 text-sm font-medium text-blue-900">
        Source Credentials Demo - {sourceName}
      </h3>

      <div className="space-y-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleTestCredentials}
          disabled={isLoading}
          className="w-full justify-start"
        >
          <Play className="mr-2 h-3 w-3" />
          Test Get Credentials
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleTestSourceInfo}
          disabled={isLoading}
          className="w-full justify-start"
        >
          <Play className="mr-2 h-3 w-3" />
          Test Source Info (No Passphrase)
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleTestPlayback}
          disabled={isLoading}
          className="w-full justify-start"
        >
          <Play className="mr-2 h-3 w-3" />
          Test Playback Preparation
        </Button>
      </div>

      <p className="mt-3 text-xs text-blue-600">
        💡 All operations use cached passphrases when available
      </p>
    </div>
  );
}
