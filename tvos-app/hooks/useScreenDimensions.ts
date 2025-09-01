import { useState, useEffect, useCallback, useRef } from 'react';
import { Dimensions } from 'react-native';

interface ScreenDimensions {
  width: number;
  height: number;
  orientation: 'portrait' | 'landscape';
}

// Debounce utility
function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  return useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]) as T;
}

export function useScreenDimensions(): ScreenDimensions {
  const [dimensions, setDimensions] = useState<ScreenDimensions>(() => {
    const { width, height } = Dimensions.get('screen');
    return {
      width,
      height,
      orientation: width > height ? 'landscape' : 'portrait',
    };
  });

  // Debounced dimension update to prevent excessive re-renders
  const debouncedUpdateDimensions = useDebounce(
    useCallback((screen: { width: number; height: number }) => {
      const { width, height } = screen;
      const newOrientation = width > height ? 'landscape' : 'portrait';
      
      // Only update if dimensions actually changed
      setDimensions(prev => {
        if (prev.width === width && prev.height === height && prev.orientation === newOrientation) {
          return prev; // No change, prevent re-render
        }
        
        return {
          width,
          height,
          orientation: newOrientation,
        };
      });
    }, []),
    100 // 100ms debounce delay
  );

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ screen }) => {
      debouncedUpdateDimensions(screen);
    });

    return () => {
      subscription?.remove();
    };
  }, [debouncedUpdateDimensions]);

  return dimensions;
}