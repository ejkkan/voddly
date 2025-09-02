import React from 'react';
import { UnifiedLayout } from './variants/UnifiedLayout';
import { ModernLayout } from './variants/ModernLayout';
import { DEFAULT_SIDEBAR_WIDTH } from './constants';

interface LayoutProps {
  channels: any[];
  programs: any[];
  timeline: any[];
  isSidebar: boolean;
  isTimeline: boolean;
  isBaseTimeFormat: boolean;
  scrollRefs: any;
  variant?: 'unified' | 'modern-grid';
  onScroll: (event: any, type: 'horizontal' | 'vertical') => void;
  onVisibleChannelsChange?: (startIndex: number, endIndex: number) => void;
  onProgramClick?: (program: any) => void;
  renderProgram?: (props: { program: any }) => React.ReactNode;
  renderChannel?: (props: { channel: any }) => React.ReactNode;
  renderTimeline?: (props: { time: Date }) => React.ReactNode;
}

export function Layout({
  channels,
  programs,
  timeline,
  isSidebar,
  isTimeline,
  isBaseTimeFormat,
  scrollRefs,
  variant = 'unified',
  onScroll,
  onVisibleChannelsChange,
  onProgramClick,
  renderProgram,
  renderChannel,
  renderTimeline,
}: LayoutProps) {
  // Calculate dynamic sidebar width
  const calculateSidebarWidth = DEFAULT_SIDEBAR_WIDTH;

  // Render Modern Grid variant
  if (variant === 'modern-grid') {
    return (
      <ModernLayout
        channels={channels}
        programs={programs}
        timeline={timeline}
        isTimeline={isTimeline}
        scrollRefs={scrollRefs}
        onScroll={onScroll}
        onVisibleChannelsChange={onVisibleChannelsChange}
        onProgramClick={onProgramClick}
        renderChannel={renderChannel}
        calculateSidebarWidth={calculateSidebarWidth}
      />
    );
  }

  // Default to Unified variant
  return (
    <UnifiedLayout
      channels={channels}
      programs={programs}
      timeline={timeline}
      isSidebar={isSidebar}
      isTimeline={isTimeline}
      isBaseTimeFormat={isBaseTimeFormat}
      scrollRefs={scrollRefs}
      onScroll={onScroll}
      onVisibleChannelsChange={onVisibleChannelsChange}
      onProgramClick={onProgramClick}
      renderProgram={renderProgram}
      renderChannel={renderChannel}
      renderTimeline={renderTimeline}
      calculateSidebarWidth={calculateSidebarWidth}
    />
  );
}