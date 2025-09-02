import React, { useRef } from 'react';
import { Platform, Pressable } from 'react-native';

import { Image, Text, View } from '@/components/ui';

import { TIMELINE_HEIGHT } from './constants';

interface DefaultRenderFunctionsProps {
  channels: any[];
  programs: any[];
  timeline: any[];
  formatTime: (date: Date) => string;
}

export function DefaultRenderFunctions({
  channels,
  programs,
  formatTime,
}: DefaultRenderFunctionsProps) {
  const isCurrentlyAiring = (program: any) => {
    const now = new Date().getTime();
    const start = new Date(program.since).getTime();
    const end = new Date(program.till).getTime();
    return now >= start && now <= end;
  };

  const defaultRenderChannel = ({ channel }: { channel: any }) => {
    return (
      <View
        className="mx-2 my-1 flex-row items-center overflow-hidden rounded-xl bg-white/60 px-4 py-3 shadow-lg backdrop-blur-2xl dark:bg-neutral-800/60"
        style={{
          height: channel.position.height - 8,
          ...(Platform.OS === 'web' ? ({ cursor: 'default' } as any) : {}),
        }}
      >
        {channel.logo && Platform.OS === 'web' ? (
          <img
            src={channel.logo}
            alt={channel.title}
            className="mr-4 size-12 object-contain"
          />
        ) : channel.logo ? (
          <Image
            source={{ uri: channel.logo }}
            className="mr-4 size-12"
            contentFit="contain"
          />
        ) : null}
        <Text
          className="flex-1 text-sm font-medium text-neutral-900 dark:text-neutral-100"
          numberOfLines={2}
        >
          {channel.title || ''}
        </Text>
      </View>
    );
  };

  const defaultRenderProgram = ({
    program,
    isFirstProgram,
  }: {
    program: any;
    isFirstProgram?: boolean;
  }) => {
    const isAiring = isCurrentlyAiring(program);
    const dragStartPos = useRef<{ x: number; y: number } | null>(null);
    const isDragging = useRef(false);

    const handlePressIn = (e: any) => {
      if (Platform.OS === 'web') {
        const event = e.nativeEvent || e;
        dragStartPos.current = {
          x: event.pageX || event.clientX,
          y: event.pageY || event.clientY,
        };
        isDragging.current = false;
      }
    };

    const handlePressOut = (e: any) => {
      if (Platform.OS === 'web' && program.onPress) {
        const event = e.nativeEvent || e;
        if (dragStartPos.current) {
          const endX = event.pageX || event.clientX;
          const endY = event.pageY || event.clientY;
          const deltaX = Math.abs(endX - dragStartPos.current.x);
          const deltaY = Math.abs(endY - dragStartPos.current.y);

          // Only trigger click if movement is less than 5 pixels
          if (deltaX < 5 && deltaY < 5 && !isDragging.current) {
            program.onPress(program);
          }
        }
        dragStartPos.current = null;
        isDragging.current = false;
      }
    };

    const handleMouseMove = (e: any) => {
      if (Platform.OS === 'web' && dragStartPos.current) {
        const event = e.nativeEvent || e;
        const currentX = event.pageX || event.clientX;
        const currentY = event.pageY || event.clientY;
        const deltaX = Math.abs(currentX - dragStartPos.current.x);
        const deltaY = Math.abs(currentY - dragStartPos.current.y);

        // Mark as dragging if movement exceeds threshold
        if (deltaX > 5 || deltaY > 5) {
          isDragging.current = true;
        }
      }
    };

    const content = (
      <View
        style={{
          position: 'absolute',
          left: program.position.left + 4,
          width: program.position.width - 8,
          top: program.position.top + 2,
          height: program.position.height - 4,
          overflow: 'hidden',
        }}
        className={`overflow-hidden rounded-xl px-3 py-2 shadow-lg backdrop-blur-xl ${
          isAiring
            ? 'bg-blue-100/70 dark:bg-blue-900/60'
            : 'bg-white/60 dark:bg-neutral-800/60'
        }`}
      >
        <Text
          className={`text-xs font-medium ${
            isAiring
              ? 'text-blue-900 dark:text-blue-100'
              : 'text-neutral-900 dark:text-neutral-100'
          }`}
          style={{ textAlign: isFirstProgram ? 'right' : 'left' }}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {program.title || ''}
        </Text>
        {program.description ? (
          <Text
            className={`mt-0.5 text-xs ${
              isAiring
                ? 'text-blue-700 dark:text-blue-300'
                : 'text-neutral-600 dark:text-neutral-400'
            }`}
            style={{ textAlign: isFirstProgram ? 'right' : 'left' }}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {program.description || ''}
          </Text>
        ) : null}
      </View>
    );

    // Wrap in Pressable for web to handle click vs drag
    if (Platform.OS === 'web' && program.onPress) {
      return (
        <Pressable
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onMouseMove={handleMouseMove}
          style={{ cursor: program.onPress ? 'pointer' : 'default' }}
        >
          {content}
        </Pressable>
      );
    }

    // For native, use regular Pressable if onPress is provided
    if (program.onPress) {
      return (
        <Pressable onPress={() => program.onPress(program)}>
          {content}
        </Pressable>
      );
    }

    return content;
  };

  const defaultRenderTimeline = ({ time }: { time: Date }) => (
    <View
      className="m-1 items-center justify-center overflow-hidden rounded-lg bg-white/60 shadow-md backdrop-blur-xl dark:bg-neutral-800/60"
      style={{ height: TIMELINE_HEIGHT - 8 }}
    >
      <Text className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
        {formatTime(time) || ''}
      </Text>
    </View>
  );

  return {
    defaultRenderChannel,
    defaultRenderProgram,
    defaultRenderTimeline,
  };
}
