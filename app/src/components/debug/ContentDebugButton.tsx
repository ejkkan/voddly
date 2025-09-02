import React from 'react';
import { Pressable, Text } from '@/components/ui';

interface ContentDebugButtonProps {
  item: any;
  contentType: 'movie' | 'series' | 'live';
  metadata?: any;
  size?: number;
}

export function ContentDebugButton({ 
  item, 
  contentType, 
  metadata, 
  size = 16 
}: ContentDebugButtonProps) {
  const handleDebugClick = () => {
    console.log(`=== ${contentType.toUpperCase()} DEBUG INFO ===`);
    console.log('Content Item:', item);
    if (metadata) {
      console.log('Metadata:', metadata);
    }
    console.log('======================');
  };

  return (
    <Pressable
      onPress={handleDebugClick}
      className="items-center justify-center rounded-full bg-orange-500/40 backdrop-blur-xl hover:bg-orange-500/60"
      style={{
        width: size * 2.5,
        height: size * 2.5,
        cursor: 'pointer' as any,
        boxShadow: '0 4px 16px rgba(255, 165, 0, 0.3)',
        border: '1px solid rgba(255, 165, 0, 0.4)',
      }}
    >
      <Text className="text-white" style={{ fontSize: size * 0.75 }}>🐛</Text>
    </Pressable>
  );
}