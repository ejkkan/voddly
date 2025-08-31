import React from 'react';
import { View } from '@/components/ui';

interface EpgProps {
  width: number;
  height: number;
  sidebarWidth: number;
  itemHeight: number;
  hourWidth: number;
  scrollX: number;
  scrollY: number;
  dateRange: {
    startDate: Date;
    endDate: Date;
  };
  currentTimePosition: number;
  isLine: boolean;
  children: React.ReactNode;
}

export function Epg({
  width,
  height,
  children,
}: EpgProps) {
  return (
    <View 
      className="relative overflow-hidden bg-white dark:bg-black"
      style={{ width, height }}
    >
      {children}
    </View>
  );
}