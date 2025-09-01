'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { apiClient } from '@/lib/api-client';

type WatchCallbacks = {
  onPlaybackStart?: (currentTimeSec: number, durationSec?: number) => void;
  onProgress?: (currentTimeSec: number, durationSec?: number) => void;
  onPlaybackEnd?: (currentTimeSec: number, durationSec?: number) => void;
  onPause?: (currentTimeSec: number, durationSec?: number) => void;
  onSeek?: (currentTimeSec: number, durationSec?: number) => void;
};

export interface PlayerPreferences {
  playbackSpeed?: number;
  audioTrack?: string;
  subtitleTrack?: string;
  qualityPreference?: string;
}

export interface UseWatchStateTrackerParams {
  profileId?: string;
  contentId?: string; // Format: {uuid}:{type}:{id}
  contentType?: string;
  reportIntervalMs?: number; // Default: 10 seconds
  playerPreferences?: PlayerPreferences;
}

export function useWatchStateTracker(params: UseWatchStateTrackerParams) {
  const {
    profileId,
    contentId,
    contentType,
    reportIntervalMs = 10_000,
    playerPreferences,
  } = params;
  const queryClient = useQueryClient();
  const [currentPreferences, setCurrentPreferences] =
    useState<PlayerPreferences>(playerPreferences || {});

  const enabled = !!profileId && !!contentId;

  const { data } = useQuery({
    queryKey: ['watch-state', profileId, contentId],
    queryFn: async () => {
      if (!profileId || !contentId) throw new Error('Missing params');
      return apiClient.user.getContentWatchState(profileId, contentId);
    },
    enabled,
    staleTime: 15_000,
  });

  const initialStartTime = useMemo(() => {
    const seconds = data?.state?.last_position_seconds;
    return typeof seconds === 'number' && seconds > 0 ? seconds : 0;
  }, [data?.state?.last_position_seconds]);

  // Initialize preferences from loaded data
  useEffect(() => {
    if (data?.state) {
      setCurrentPreferences((prev) => ({
        playbackSpeed:
          prev.playbackSpeed || data.state.playback_speed || undefined,
        audioTrack: prev.audioTrack || data.state.audio_track || undefined,
        subtitleTrack:
          prev.subtitleTrack || data.state.subtitle_track || undefined,
        qualityPreference:
          prev.qualityPreference || data.state.quality_preference || undefined,
      }));
    }
  }, [data?.state]);

  const watchPreferences = useMemo(() => {
    return currentPreferences;
  }, [currentPreferences]);

  const lastSentAtRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const lastDurationRef = useRef<number | undefined>(undefined);
  const startedRef = useRef<boolean>(false);
  const completedRef = useRef<boolean>(false);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentPreferencesRef = useRef<PlayerPreferences>(currentPreferences);

  // Keep ref in sync with state
  useEffect(() => {
    currentPreferencesRef.current = currentPreferences;
  }, [currentPreferences]);

  const updateMutation = useMutation({
    mutationFn: async (params: {
      positionSec: number;
      durationSec?: number;
      completed?: boolean;
      preferences?: PlayerPreferences;
    }) => {
      if (!profileId || !contentId) return;

      const { positionSec, durationSec, completed, preferences } = params;

      // Check if content is completed (within 95% of total duration)
      const isCompleted =
        completed || (durationSec && positionSec >= durationSec * 0.95);

      // Merge passed preferences with current ones (use ref for latest value)
      const mergedPreferences = {
        ...currentPreferencesRef.current,
        ...preferences,
      };

      const updatePayload = {
        profileId,
        contentId,
        contentType,
        lastPositionSeconds: Math.max(0, Math.floor(positionSec || 0)),
        totalDurationSeconds:
          durationSec !== undefined && durationSec !== null
            ? Math.max(0, Math.floor(durationSec))
            : undefined,
        completed: !!isCompleted, // Ensure it's a boolean
        playbackSpeed: mergedPreferences.playbackSpeed || undefined,
        audioTrack: mergedPreferences.audioTrack || undefined,
        subtitleTrack: mergedPreferences.subtitleTrack || undefined,
        qualityPreference: mergedPreferences.qualityPreference || undefined,
      };

      console.log(
        '[useWatchStateTracker] Mutation - merged preferences:',
        mergedPreferences
      );
      console.log(
        '[useWatchStateTracker] Mutation - sending payload:',
        JSON.stringify(updatePayload, null, 2)
      );

      return apiClient.user.updateWatchState(updatePayload as any);
    },
    // Removed onSuccess to avoid query invalidation causing re-renders
  });

  const sendUpdate = useCallback(
    async (positionSec: number, durationSec?: number, completed?: boolean) => {
      console.log('[useWatchStateTracker] sendUpdate called with:', {
        positionSec,
        durationSec,
        completed,
        preferences: currentPreferencesRef.current,
      });

      lastTimeRef.current = positionSec || 0;
      lastDurationRef.current = durationSec;

      if (completed) {
        completedRef.current = true;
      }

      try {
        await updateMutation.mutateAsync({
          positionSec,
          durationSec,
          completed: !!(completed || completedRef.current), // Ensure it's a boolean
          preferences: currentPreferencesRef.current, // Use ref for latest preferences
        });
        console.log('[useWatchStateTracker] Update sent successfully');
      } catch (error) {
        console.error('[useWatchStateTracker] Error sending update:', error);
      }
    },
    [updateMutation] // No need to depend on currentPreferences since we use ref
  );

  const onPlaybackStart = useCallback<
    NonNullable<WatchCallbacks['onPlaybackStart']>
  >(
    (currentTimeSec, durationSec) => {
      lastTimeRef.current = currentTimeSec || 0;
      lastDurationRef.current = durationSec;
      completedRef.current = false;

      if (!startedRef.current) {
        startedRef.current = true;
        void sendUpdate(currentTimeSec || 0, durationSec);

        // Start periodic updates every 10 seconds
        if (updateIntervalRef.current) {
          clearInterval(updateIntervalRef.current);
        }

        updateIntervalRef.current = setInterval(() => {
          if (lastTimeRef.current > 0) {
            void sendUpdate(lastTimeRef.current, lastDurationRef.current);
          }
        }, reportIntervalMs);
      }
    },
    [sendUpdate, reportIntervalMs]
  );

  const onProgress = useCallback<NonNullable<WatchCallbacks['onProgress']>>(
    (currentTimeSec, durationSec) => {
      lastTimeRef.current = currentTimeSec || 0;
      lastDurationRef.current = durationSec;

      // Check if content is near completion (95% watched)
      if (
        durationSec &&
        currentTimeSec >= durationSec * 0.95 &&
        !completedRef.current
      ) {
        completedRef.current = true;
        void sendUpdate(currentTimeSec || 0, durationSec, true);
      }
    },
    [sendUpdate]
  );

  const onPlaybackEnd = useCallback<
    NonNullable<WatchCallbacks['onPlaybackEnd']>
  >(
    (currentTimeSec, durationSec) => {
      lastTimeRef.current = currentTimeSec || lastTimeRef.current || 0;
      lastDurationRef.current = durationSec ?? lastDurationRef.current;

      // Clear the update interval
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }

      // Send a final update, marking as completed if near the end
      const isNearEnd =
        lastDurationRef.current &&
        lastTimeRef.current >= lastDurationRef.current * 0.95;
      void sendUpdate(
        lastTimeRef.current,
        lastDurationRef.current,
        isNearEnd || completedRef.current
      );

      startedRef.current = false;
    },
    [sendUpdate]
  );

  const onPause = useCallback<NonNullable<WatchCallbacks['onPause']>>(
    (currentTimeSec, durationSec) => {
      lastTimeRef.current = currentTimeSec || 0;
      lastDurationRef.current = durationSec;
      // Send update immediately on pause
      void sendUpdate(currentTimeSec || 0, durationSec);
    },
    [sendUpdate]
  );

  const onSeek = useCallback<NonNullable<WatchCallbacks['onSeek']>>(
    (currentTimeSec, durationSec) => {
      lastTimeRef.current = currentTimeSec || 0;
      lastDurationRef.current = durationSec;
      // Send update immediately on seek
      void sendUpdate(currentTimeSec || 0, durationSec);
    },
    [sendUpdate]
  );

  // Function to update preferences and immediately send to backend
  const updatePreferences = useCallback(
    async (newPrefs: Partial<PlayerPreferences>) => {
      console.log('[useWatchStateTracker] Updating preferences:', newPrefs);

      // Update the ref immediately so it's available for the mutation
      const updatedPrefs = { ...currentPreferencesRef.current, ...newPrefs };
      currentPreferencesRef.current = updatedPrefs;

      // Also update state for UI
      setCurrentPreferences(updatedPrefs);

      console.log(
        '[useWatchStateTracker] Updated preferences to:',
        updatedPrefs
      );

      // Send update immediately with new preferences
      const currentTime = lastTimeRef.current || 0;
      const duration = lastDurationRef.current;

      console.log(
        '[useWatchStateTracker] Sending immediate update after preference change'
      );

      // Call mutation directly with the updated preferences
      try {
        await updateMutation.mutateAsync({
          positionSec: currentTime,
          durationSec: duration,
          completed: !!completedRef.current,
          preferences: updatedPrefs, // Pass the updated preferences directly
        });
        console.log(
          '[useWatchStateTracker] Preference update sent successfully'
        );
      } catch (error) {
        console.error(
          '[useWatchStateTracker] Error sending preference update:',
          error
        );
      }
    },
    [updateMutation]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear the update interval
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }

      // Send final update if enabled
      if (enabled && lastTimeRef.current > 0) {
        // Use the mutation directly instead of sendUpdate to avoid dependency issues
        updateMutation.mutate({
          positionSec: lastTimeRef.current || 0,
          durationSec: lastDurationRef.current,
          completed: !!completedRef.current, // Ensure it's a boolean
          preferences: currentPreferencesRef.current, // Use ref for latest preferences
        });
      }
    };
    // Only re-run when component unmounts or enabled changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return {
    startTime: initialStartTime,
    preferences: watchPreferences,
    callbacks: {
      onPlaybackStart,
      onProgress,
      onPlaybackEnd,
      onPause,
      onSeek,
    } as WatchCallbacks,
    updatePreferences,
    isLoading: updateMutation.isPending,
  };
}

export type UseWatchStateTrackerReturn = ReturnType<
  typeof useWatchStateTracker
>;
