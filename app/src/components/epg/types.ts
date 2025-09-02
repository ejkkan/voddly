import React from 'react';

export interface Channel {
  uuid: string;
  title: string;
  logo?: string;
  position: {
    top: number;
    height: number;
  };
  [key: string]: any;
}

export interface Program {
  channelUuid: string;
  id: string;
  title: string;
  since: string | Date;
  till: string | Date;
  description?: string;
  position: {
    top: number;
    left: number;
    width: number;
    height: number;
    channelIndex?: number;
  };
  [key: string]: any;
}

export interface TimelineItem {
  time: Date;
  position: {
    left: number;
    width: number;
  };
}

export interface BaseLayoutProps {
  channels: Channel[];
  programs: Program[];
  timeline: TimelineItem[];
  isSidebar: boolean;
  isTimeline: boolean;
  isBaseTimeFormat: boolean;
  scrollRefs: any;
  onScroll: (event: any, type: 'horizontal' | 'vertical') => void;
  onVisibleChannelsChange?: (startIndex: number, endIndex: number) => void;
  onProgramClick?: (program: any) => void;
  renderProgram?: (props: { program: any }) => React.ReactNode;
  renderChannel?: (props: { channel: any }) => React.ReactNode;
  renderTimeline?: (props: { time: Date }) => React.ReactNode;
  calculateSidebarWidth: number;
}

export interface UnifiedLayoutProps extends BaseLayoutProps {}

export interface ModernLayoutProps extends Omit<BaseLayoutProps, 'isBaseTimeFormat' | 'renderProgram' | 'renderTimeline' | 'isSidebar'> {}