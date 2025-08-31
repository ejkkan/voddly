import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface Channel {
  uuid: string;
  title: string;
  logo?: string;
  [key: string]: any;
}

export interface Program {
  channelUuid: string;
  id: string;
  title: string;
  since: string | Date;
  till: string | Date;
  description?: string;
  [key: string]: any;
}

export interface EpgConfig {
  channels: Channel[];
  epg: Program[];
  startDate?: string | Date;
  endDate?: string | Date;
  width?: number;
  height?: number;
  sidebarWidth?: number;
  itemHeight?: number;
  dayWidth?: number;
  isSidebar?: boolean;
  isTimeline?: boolean;
  isLine?: boolean;
  isBaseTimeFormat?: boolean;
  theme?: any;
  variant?: 'separate' | 'unified';
}

export function useEpg({
  channels = [],
  epg = [],
  startDate,
  endDate,
  width = 1200,
  height = 600,
  sidebarWidth = 200,
  itemHeight = 80,
  dayWidth = 7200, // pixels per day
  isSidebar = true,
  isTimeline = true,
  isLine = true,
  isBaseTimeFormat = false,
  variant = 'separate',
}: EpgConfig) {
  const [scrollX, setScrollX] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const scrollRefs = useRef<{ [key: string]: any }>({});
  console.log('channels', channels);
  console.log('epg', epg);
  console.log('startDate', startDate);
  console.log('endDate', endDate);
  console.log('width', width);
  console.log('height', height);
  console.log('sidebarWidth', sidebarWidth);
  // Calculate time range - start from 1 hour ago to keep "now" visible
  const dateRange = useMemo(() => {
    const now = new Date();
    const start = startDate
      ? new Date(startDate)
      : new Date(now.getTime() - 1 * 60 * 60 * 1000); // 1 hour ago
    const end = endDate
      ? new Date(endDate)
      : new Date(now.getTime() + 23 * 60 * 60 * 1000); // 23 hours ahead (total 24 hours)
    return { startDate: start, endDate: end };
  }, [startDate, endDate]);

  // Calculate hour width based on day width
  const hourWidth = useMemo(() => {
    return dayWidth / 24;
  }, [dayWidth]);

  // Process channels
  const processedChannels = useMemo(() => {
    return channels.map((channel, index) => ({
      ...channel,
      position: {
        top: index * itemHeight,
        height: itemHeight,
      },
    }));
  }, [channels, itemHeight]);

  // Process programs with positions
  const processedPrograms = useMemo(() => {
    const rangeStart = dateRange.startDate.getTime();
    const rangeEnd = dateRange.endDate.getTime();

    return epg
      .map((program) => {
        const channelIndex = channels.findIndex(
          (ch) => ch.uuid === program.channelUuid
        );
        if (channelIndex === -1) return null;

        const start = new Date(program.since).getTime();
        const end = new Date(program.till).getTime();

        // Skip programs outside the visible range
        if (end < rangeStart || start > rangeEnd) return null;

        // Calculate position
        const left = ((start - rangeStart) / (1000 * 60 * 60)) * hourWidth;
        const duration = (end - start) / (1000 * 60 * 60);
        const width = Math.max(duration * hourWidth, 50); // min width

        return {
          ...program,
          position: {
            top: channelIndex * itemHeight,
            left,
            width,
            height: itemHeight - 8,
            channelIndex,
          },
          data: program,
        };
      })
      .filter(Boolean);
  }, [epg, channels, dateRange, hourWidth, itemHeight]);

  // Generate timeline
  const timeline = useMemo(() => {
    const hours = [];
    const current = new Date(dateRange.startDate);
    current.setMinutes(0, 0, 0);

    while (current <= dateRange.endDate) {
      hours.push({
        time: new Date(current),
        position: {
          left:
            ((current.getTime() - dateRange.startDate.getTime()) /
              (1000 * 60 * 60)) *
            hourWidth,
          width: hourWidth,
        },
      });
      current.setHours(current.getHours() + 1);
    }
    return hours;
  }, [dateRange, hourWidth]);

  // Calculate current time position
  const currentTimePosition = useMemo(() => {
    const now = new Date();
    const rangeStart = dateRange.startDate.getTime();
    return ((now.getTime() - rangeStart) / (1000 * 60 * 60)) * hourWidth;
  }, [dateRange, hourWidth]);

  // Scroll handlers - position "now" slightly left of center for better visibility
  const onScrollToNow = useCallback(() => {
    // Position "now" at about 1/3 of the viewport width for better visibility
    const scrollTo = currentTimePosition - (width - sidebarWidth) / 3;
    setScrollX(Math.max(0, scrollTo));
    
    // Handle unified variant
    if (variant === 'unified' && scrollRefs.current.main) {
      scrollRefs.current.main.scrollTo({
        x: Math.max(0, scrollTo),
        animated: true,
      });
    } else if (scrollRefs.current.horizontal) {
      scrollRefs.current.horizontal.scrollTo({
        x: Math.max(0, scrollTo),
        animated: true,
      });
    }
  }, [currentTimePosition, width, sidebarWidth, variant]);

  // Auto-scroll to current time on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      onScrollToNow();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const onScrollLeft = useCallback(() => {
    const newScroll = Math.max(0, scrollX - hourWidth * 3);
    setScrollX(newScroll);
    
    // Handle unified variant
    if (variant === 'unified' && scrollRefs.current.main) {
      scrollRefs.current.main.scrollTo({ x: newScroll, animated: true });
    } else if (scrollRefs.current.horizontal) {
      scrollRefs.current.horizontal.scrollTo({ x: newScroll, animated: true });
    }
  }, [scrollX, hourWidth, variant]);

  const onScrollRight = useCallback(() => {
    const maxScroll = timeline.length * hourWidth - (width - sidebarWidth);
    const newScroll = Math.min(maxScroll, scrollX + hourWidth * 3);
    setScrollX(newScroll);
    
    // Handle unified variant
    if (variant === 'unified' && scrollRefs.current.main) {
      scrollRefs.current.main.scrollTo({ x: newScroll, animated: true });
    } else if (scrollRefs.current.horizontal) {
      scrollRefs.current.horizontal.scrollTo({ x: newScroll, animated: true });
    }
  }, [scrollX, hourWidth, timeline, width, sidebarWidth, variant]);

  const onScrollTop = useCallback(() => {
    setScrollY(0);
    if (scrollRefs.current.vertical) {
      scrollRefs.current.vertical.scrollTo({ y: 0, animated: true });
    }
  }, []);

  const onScrollDown = useCallback(() => {
    const newScroll = Math.min(
      (channels.length - 1) * itemHeight,
      scrollY + itemHeight * 3
    );
    setScrollY(newScroll);
    if (scrollRefs.current.vertical) {
      scrollRefs.current.vertical.scrollTo({ y: newScroll, animated: true });
    }
  }, [scrollY, channels.length, itemHeight]);

  // Get props functions
  const getEpgProps = useCallback(
    () => ({
      width,
      height,
      sidebarWidth,
      itemHeight,
      hourWidth,
      scrollX,
      scrollY,
      dateRange,
      currentTimePosition,
      isLine,
    }),
    [
      width,
      height,
      sidebarWidth,
      itemHeight,
      hourWidth,
      scrollX,
      scrollY,
      dateRange,
      currentTimePosition,
      isLine,
    ]
  );

  const getLayoutProps = useCallback(
    () => ({
      channels: processedChannels,
      programs: processedPrograms,
      timeline,
      isSidebar,
      isTimeline,
      isBaseTimeFormat,
      scrollRefs,
      variant,
      onScroll: (event: any, type: 'horizontal' | 'vertical') => {
        if (type === 'horizontal') {
          setScrollX(event.nativeEvent.contentOffset.x);
        } else {
          setScrollY(event.nativeEvent.contentOffset.y);
        }
      },
    }),
    [
      processedChannels,
      processedPrograms,
      timeline,
      isSidebar,
      isTimeline,
      isBaseTimeFormat,
      variant,
    ]
  );

  return {
    getEpgProps,
    getLayoutProps,
    onScrollToNow,
    onScrollLeft,
    onScrollRight,
    onScrollTop,
    onScrollDown,
    scrollX,
    scrollY,
  };
}
