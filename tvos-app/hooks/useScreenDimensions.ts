import { useState, useEffect } from 'react';
import { Dimensions } from 'react-native';

interface ScreenDimensions {
  width: number;
  height: number;
  orientation: 'portrait' | 'landscape';
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

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ screen }) => {
      const { width, height } = screen;
      setDimensions({
        width,
        height,
        orientation: width > height ? 'landscape' : 'portrait',
      });
    });

    return () => subscription?.remove();
  }, []);

  return dimensions;
}