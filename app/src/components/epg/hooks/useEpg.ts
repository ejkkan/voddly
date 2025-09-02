import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

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
  variant?: 'unified' | 'modern-grid';
}

export function useEpg({
  channels = [],
  epg = [],
  startDate,
  endDate,
  width = 1200,
  height = 600,
  sidebarWidth,
  itemHeight = 100,
  dayWidth = 7200, // pixels per day
  isSidebar = true,
  isTimeline = true,
  isLine = true,
  isBaseTimeFormat = false,
  variant = 'unified',
}: EpgConfig) {
  // Calculate dynamic sidebar width based on longest channel name
  const calculatedSidebarWidth = React.useMemo(() => {
    if (sidebarWidth) return sidebarWidth; // Use provided width if specified
    if (!channels || channels.length === 0) return 250;

    // Find the longest channel title
    const longestTitle = channels.reduce((longest, channel) => {
      const title = channel.title || '';
      return title.length > longest.length ? title : longest;
    }, '');

    // Estimate width: ~8px per character + padding + logo space
    const estimatedWidth = Math.max(
      250, // MIN_SIDEBAR_WIDTH
      Math.min(
        500, // MAX_SIDEBAR_WIDTH
        longestTitle.length * 8 + 100 // 100px for padding, logo, and margins
      )
    );

    return estimatedWidth;
  }, [channels, sidebarWidth]);

  const [scrollX, setScrollX] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const scrollRefs = useRef<{ [key: string]: any }>({});

  // Calculate time range - start from 30 minutes ago for next 12 hours
  const dateRange = useMemo(() => {
    const now = new Date();
    const start = startDate
      ? new Date(startDate)
      : new Date(now.getTime() - 0.5 * 60 * 60 * 1000); // 30 minutes ago
    const end = endDate
      ? new Date(endDate)
      : new Date(now.getTime() + 12 * 60 * 60 * 1000); // 12 hours ahead
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

    // First pass: create programs with initial positions
    const programsWithPositions = epg
      .map((program) => {
        const channelIndex = channels.findIndex(
          (ch) => ch.uuid === program.channelUuid
        );
        if (channelIndex === -1) return null;

        const start = new Date(program.since).getTime();
        const end = new Date(program.till).getTime();

        // Skip programs outside the visible range
        if (end < rangeStart || start > rangeEnd) return null;

        // Calculate position - use precise positioning without rounding
        const originalLeft = ((start - rangeStart) / (1000 * 60 * 60)) * hourWidth;
        let left = originalLeft;
        
        // For programs that started before the visible range, position them at 0
        if (start < rangeStart) {
          left = 0;
        }
        
        const duration = (end - start) / (1000 * 60 * 60);
        const width = Math.max(duration * hourWidth, 50); // min width

        // Pre-compute commonly used values
        const trimmedTitle = program.title?.trim() || '';
        const isPlaceholder = program.id?.includes('placeholder') || false;
        const hasContent = !!trimmedTitle && !isPlaceholder;
        
        return {
          ...program,
          position: {
            // For unified layout: use absolute positioning across all channels
            top: channelIndex * itemHeight,
            left,
            width,
            height: itemHeight - 8,
            channelIndex,
            originalWidth: width, // Store original width before any adjustments
            originalLeft, // Store the unclamped original left position
          },
          data: program,
          // Memoized computed properties
          computed: {
            trimmedTitle,
            isPlaceholder,
            hasContent,
            startTime: start,
            endTime: end,
            duration: end - start,
          },
        };
      })
      .filter(Boolean);

    // Second pass: adjust widths to prevent overlaps
    const programsByChannel = {};
    programsWithPositions.forEach(program => {
      if (!programsByChannel[program.channelUuid]) {
        programsByChannel[program.channelUuid] = [];
      }
      programsByChannel[program.channelUuid].push(program);
    });

    // Sort programs by start time and handle overlaps
    Object.keys(programsByChannel).forEach(channelUuid => {
      const channelPrograms = programsByChannel[channelUuid].sort(
        (a, b) => new Date(a.since).getTime() - new Date(b.since).getTime()
      );
      
      // Find programs that started before visible range and overlap
      const preRangePrograms = channelPrograms.filter(p => 
        new Date(p.since).getTime() < rangeStart && 
        new Date(p.till).getTime() > rangeStart
      );
      
      // If multiple programs started before range and overlap, merge them
      if (preRangePrograms.length > 1) {
        // Find overlapping pre-range programs
        const overlappingPreRange = [];
        for (let i = 0; i < preRangePrograms.length; i++) {
          const current = preRangePrograms[i];
          const hasOverlap = preRangePrograms.some((other, otherIndex) => {
            if (otherIndex === i) return false;
            const currentStart = new Date(current.since).getTime();
            const currentEnd = new Date(current.till).getTime();
            const otherStart = new Date(other.since).getTime();
            const otherEnd = new Date(other.till).getTime();
            return (currentStart < otherEnd && currentEnd > otherStart);
          });
          
          if (hasOverlap) {
            overlappingPreRange.push(current);
          }
        }
        
        if (overlappingPreRange.length > 1) {
          // Remove duplicate programs (same title and times, regardless of ID)
          const uniquePrograms = [];
          const seen = new Set();
          
          overlappingPreRange.forEach(program => {
            const key = `${program.title}-${new Date(program.since).getTime()}-${new Date(program.till).getTime()}`;
            if (!seen.has(key)) {
              seen.add(key);
              uniquePrograms.push(program);
            }
          });
          
          // Additional check: if all programs have the same title, just keep one
          const uniqueTitles = [...new Set(uniquePrograms.map(p => p.title))];
          if (uniqueTitles.length === 1) {
            // All programs have same title, just keep the first one
            const program = uniquePrograms[0];
            // Preserve originalLeft for progress calculation, but set display left to 0
            program.position.originalLeft = program.position.originalLeft || program.position.left;
            program.position.left = 0;
            
            // Remove all duplicates except the first
            overlappingPreRange.slice(1).forEach(p => {
              const index = channelPrograms.indexOf(p);
              if (index > -1) channelPrograms.splice(index, 1);
            });
          } else if (uniquePrograms.length > 1) {
            // Create merged program
            const earliestStart = Math.min(...uniquePrograms.map(p => new Date(p.since).getTime()));
            const latestEnd = Math.max(...uniquePrograms.map(p => new Date(p.till).getTime()));
            const titles = uniquePrograms.map(p => p.title).join(' / ');
            
            const mergedProgram = {
              ...uniquePrograms[0],
              id: `merged-${uniquePrograms.map(p => p.id).join('-')}`,
              title: titles,
              description: 'Mixed programming',
              since: new Date(earliestStart),
              till: new Date(latestEnd),
              position: {
                ...uniquePrograms[0].position,
                left: 0, // Always start at 0 for merged pre-range programs
                width: Math.max(((latestEnd - rangeStart) / (1000 * 60 * 60)) * hourWidth, 50),
                originalLeft: ((earliestStart - rangeStart) / (1000 * 60 * 60)) * hourWidth, // Preserve original calculation for progress
              }
            };
            
            // Remove original overlapping programs and add merged one
            overlappingPreRange.forEach(p => {
              const index = channelPrograms.indexOf(p);
              if (index > -1) channelPrograms.splice(index, 1);
            });
            channelPrograms.unshift(mergedProgram);
          }
          
          // Re-sort after adding merged program
          channelPrograms.sort((a, b) => new Date(a.since).getTime() - new Date(b.since).getTime());
        }
      }
      
      // Handle remaining overlaps for programs within visible range
      for (let i = 0; i < channelPrograms.length; i++) {
        const currentProgram = channelPrograms[i];
        
        // Check if this program overlaps with previous program
        if (i > 0) {
          const prevProgram = channelPrograms[i - 1];
          const prevEnd = prevProgram.position.left + prevProgram.position.width;
          
          // Only adjust overlaps for programs that both start within visible range
          const programStart = new Date(currentProgram.since).getTime();
          const prevProgramStart = new Date(prevProgram.since).getTime();
          
          if (currentProgram.position.left < prevEnd && 
              programStart >= rangeStart && 
              prevProgramStart >= rangeStart) {
            console.warn(`Overlap detected: "${currentProgram.title}" overlaps with "${prevProgram.title}"`);
            // Move current program to start after previous with small gap
            currentProgram.position.left = prevEnd + 2;
            
            // Recalculate width based on new position
            const programEnd = new Date(currentProgram.till).getTime();
            const endPosition = ((programEnd - rangeStart) / (1000 * 60 * 60)) * hourWidth;
            currentProgram.position.width = Math.max(50, endPosition - currentProgram.position.left);
          }
        }
        
        // Check if this program would overlap with next program
        if (i < channelPrograms.length - 1) {
          const nextProgram = channelPrograms[i + 1];
          const currentEnd = currentProgram.position.left + currentProgram.position.width;
          
          // If current program would overlap with next, clamp its width
          if (currentEnd > nextProgram.position.left) {
            const maxWidth = nextProgram.position.left - currentProgram.position.left - 2;
            currentProgram.position.width = Math.max(50, maxWidth);
          }
        }
      }
    });

    // Flatten the modified programs back into a single array
    const finalPrograms = [];
    Object.values(programsByChannel).forEach(channelPrograms => {
      finalPrograms.push(...channelPrograms);
    });

    return finalPrograms;
  }, [epg, channels, dateRange, hourWidth, itemHeight, variant]);

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
    const scrollTo = currentTimePosition - (width - calculatedSidebarWidth) / 3;
    setScrollX(Math.max(0, scrollTo));

    // Handle different variants
    if (variant === 'unified' && scrollRefs.current.main) {
      scrollRefs.current.main.scrollTo({
        x: Math.max(0, scrollTo),
        animated: true,
      });
    } else if (variant === 'modern-grid' && scrollRefs.current.horizontalMain) {
      scrollRefs.current.horizontalMain.scrollTo({
        x: Math.max(0, scrollTo),
        animated: true,
      });
    }
  }, [currentTimePosition, width, calculatedSidebarWidth, variant]);

  // Auto-scroll to current time on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      onScrollToNow();
    }, 100);
    return () => clearTimeout(timer);
  }, [onScrollToNow]);

  const onScrollLeft = useCallback(() => {
    const newScroll = Math.max(0, scrollX - hourWidth * 3);
    setScrollX(newScroll);

    // Handle different variants
    if (variant === 'unified' && scrollRefs.current.main) {
      scrollRefs.current.main.scrollTo({ x: newScroll, animated: true });
    } else if (variant === 'modern-grid' && scrollRefs.current.horizontalMain) {
      scrollRefs.current.horizontalMain.scrollTo({
        x: newScroll,
        animated: true,
      });
    }
  }, [scrollX, hourWidth, variant]);

  const onScrollRight = useCallback(() => {
    const maxScroll =
      timeline.length * hourWidth - (width - calculatedSidebarWidth);
    const newScroll = Math.min(maxScroll, scrollX + hourWidth * 3);
    setScrollX(newScroll);

    // Handle different variants
    if (variant === 'unified' && scrollRefs.current.main) {
      scrollRefs.current.main.scrollTo({ x: newScroll, animated: true });
    } else if (variant === 'modern-grid' && scrollRefs.current.horizontalMain) {
      scrollRefs.current.horizontalMain.scrollTo({
        x: newScroll,
        animated: true,
      });
    }
  }, [scrollX, hourWidth, timeline, width, calculatedSidebarWidth, variant]);

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
      sidebarWidth: calculatedSidebarWidth,
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
      calculatedSidebarWidth,
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
