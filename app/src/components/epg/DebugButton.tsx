import React from 'react';
import { Pressable, Text } from '@/components/ui';

interface Program {
  channelUuid: string;
  id: string;
  title: string;
  since: string | Date;
  till: string | Date;
  description?: string;
  [key: string]: any;
}

interface DebugButtonProps {
  program: Program;
  allPrograms: Program[];
  size?: number;
  progress?: number;
  calculateSidebarWidth?: number;
  isAiring?: boolean;
  isFirstProgram?: boolean;
  isLastProgram?: boolean;
}

export function DebugButton({
  program,
  allPrograms,
  size = 12,
  progress,
  calculateSidebarWidth,
  isAiring,
  isFirstProgram,
  isLastProgram,
}: DebugButtonProps) {
  const handleDebugClick = () => {
    // Find neighboring programs on the same channel
    const channelPrograms = allPrograms
      .filter((p) => p.channelUuid === program.channelUuid)
      .sort(
        (a, b) => new Date(a.since).getTime() - new Date(b.since).getTime()
      );

    const currentIndex = channelPrograms.findIndex((p) => p.id === program.id);
    const previousProgram =
      currentIndex > 0 ? channelPrograms[currentIndex - 1] : null;
    const nextProgram =
      currentIndex < channelPrograms.length - 1
        ? channelPrograms[currentIndex + 1]
        : null;

    // Calculate additional debug values
    const now = new Date();
    const start = new Date(program.since);
    const end = new Date(program.till);
    const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60); // hours
    const timeElapsed = (now.getTime() - start.getTime()) / (1000 * 60); // minutes
    const timeRemaining = (end.getTime() - now.getTime()) / (1000 * 60); // minutes

    // Create comprehensive debug JSON
    const debugInfo = {
      current_program: {
        id: program.id,
        title: program.title,
        description: program.description || null,
        channel_uuid: program.channelUuid,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        duration_hours: parseFloat(duration.toFixed(2)),
      },
      calculations: {
        progress_percentage:
          progress !== undefined ? parseFloat(progress.toFixed(2)) : null,
        time_elapsed_minutes: parseFloat(timeElapsed.toFixed(1)),
        time_remaining_minutes: parseFloat(timeRemaining.toFixed(1)),
        is_airing: isAiring || false,
        is_first_program: isFirstProgram || false,
        is_last_program: isLastProgram || false,
      },
      position: program.position
        ? {
            left: program.position.left,
            width: program.position.width,
            top: program.position.top,
            height: program.position.height,
            final_left_position:
              calculateSidebarWidth !== undefined
                ? calculateSidebarWidth + program.position.left
                : null,
          }
        : null,
      layout: {
        sidebar_width: calculateSidebarWidth || null,
      },
      neighboring_programs: {
        previous: previousProgram
          ? {
              id: previousProgram.id,
              title: previousProgram.title,
              start_time: new Date(previousProgram.since).toISOString(),
              end_time: new Date(previousProgram.till).toISOString(),
            }
          : null,
        next: nextProgram
          ? {
              id: nextProgram.id,
              title: nextProgram.title,
              start_time: new Date(nextProgram.since).toISOString(),
              end_time: new Date(nextProgram.till).toISOString(),
            }
          : null,
      },
      channel_info: {
        total_programs: channelPrograms.length,
        current_program_index: currentIndex,
        channel_uuid: program.channelUuid,
      },
      timestamps: {
        debug_time: now.toISOString(),
        start_local: start.toLocaleString(),
        end_local: end.toLocaleString(),
        current_local: now.toLocaleString(),
      },
    };

    console.log('=== EPG DEBUG INFO (JSON) ===');
    console.log(JSON.stringify(debugInfo, null, 2));
    console.log('=============================');
  };

  return (
    <Pressable
      onPress={handleDebugClick}
      className="items-center justify-center rounded-full bg-orange-500/40 backdrop-blur-2xl hover:bg-orange-500/60"
      style={{
        width: size * 4,
        height: size * 4,
        cursor: 'pointer' as any,
        boxShadow:
          '0 4px 16px rgba(255, 165, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
        borderWidth: 1,
        borderColor: 'rgba(255, 165, 0, 0.4)',
      }}
    >
      <Text className="text-white" style={{ fontSize: size }}>
        🐛
      </Text>
    </Pressable>
  );
}
