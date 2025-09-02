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
}

export function DebugButton({ program, allPrograms, size = 12 }: DebugButtonProps) {
  const handleDebugClick = () => {
    // Find neighboring programs on the same channel
    const channelPrograms = allPrograms
      .filter(p => p.channelUuid === program.channelUuid)
      .sort((a, b) => new Date(a.since).getTime() - new Date(b.since).getTime());

    const currentIndex = channelPrograms.findIndex(p => p.id === program.id);
    const previousProgram = currentIndex > 0 ? channelPrograms[currentIndex - 1] : null;
    const nextProgram = currentIndex < channelPrograms.length - 1 ? channelPrograms[currentIndex + 1] : null;

    console.log('=== EPG DEBUG INFO ===');
    console.log('Current Program:', program);
    if (previousProgram) {
      console.log('Previous Program:', previousProgram);
    }
    if (nextProgram) {
      console.log('Next Program:', nextProgram);
    }
    console.log('Channel Programs Count:', channelPrograms.length);
    console.log('Current Index:', currentIndex);
    console.log('======================');
  };

  return (
    <Pressable
      onPress={handleDebugClick}
      className="items-center justify-center rounded-full bg-orange-500/40 backdrop-blur-2xl hover:bg-orange-500/60"
      style={{
        width: size * 4,
        height: size * 4,
        cursor: 'pointer' as any,
        boxShadow: '0 4px 16px rgba(255, 165, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
        border: '1px solid rgba(255, 165, 0, 0.4)',
      }}
    >
      <Text className="text-white" style={{ fontSize: size }}>🐛</Text>
    </Pressable>
  );
}