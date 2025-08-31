import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

export function useScrollPosition() {
  const [scrollY, setScrollY] = useState(0);
  const [isAtTop, setIsAtTop] = useState(true);
  const scrollYShared = useSharedValue(0);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleScroll = () => {
      const currentScrollY = window.pageYOffset || document.documentElement.scrollTop;
      console.log('Scroll detected:', currentScrollY);
      scrollYShared.value = currentScrollY;
      setScrollY(currentScrollY);
      setIsAtTop(currentScrollY < 50);
    };

    // Initial call
    handleScroll();

    // Listen to both window and document scroll events
    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('scroll', handleScroll);
    };
  }, [scrollYShared]);

  return { scrollY, isAtTop, scrollYShared };
}