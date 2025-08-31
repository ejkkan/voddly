import { usePathname } from 'expo-router';
import React from 'react';
import { Platform, useWindowDimensions } from 'react-native';

import { SafeAreaView, View } from '@/components/ui';
import { SearchProvider } from '@/contexts/SearchContext';

import { BottomTabBar } from './BottomTabBar';
import { MobileTopBar } from './MobileTopBar';
import { SearchOverlay } from './SearchOverlay';
import { Sidebar } from './Sidebar';
import { TopNav } from './TopNav';

interface NavigationLayoutProps {
  children: React.ReactNode;
}

const DESKTOP_BREAKPOINT = 900;
const TOP_NAV_HEIGHT = 64;
const SIDEBAR_WIDTH = 80; // Icon-only sidebar width
const BOTTOM_TAB_HEIGHT = Platform.OS === 'ios' ? 80 : 60;
const MOBILE_TOP_BAR_HEIGHT = 56;

export function NavigationLayout({ children }: NavigationLayoutProps) {
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const isDesktop = width >= DESKTOP_BREAKPOINT;

  // Check if we're on a content page that needs the mobile top bar
  const showMobileTopBar =
    !isDesktop &&
    (pathname === '/(app)/dashboard' ||
      pathname === '/(app)/movies' ||
      pathname === '/(app)/series' ||
      pathname === '/(app)/tv' ||
      pathname === '/(app)');

  return (
    <SearchProvider>
      {isDesktop ? (
        <View className="relative flex-1 bg-transparent">
          {/* Content layer - full screen, scrolls behind navigation */}
          <View className="absolute inset-0">
            {/* Content can scroll under both sidebar and floating island */}
            <View
              className="flex-1"
              style={{ paddingLeft: SIDEBAR_WIDTH, paddingRight: 12 }}
            >
              {children}
            </View>
          </View>

          {/* Navigation layer - Both sidebar and top nav floating above */}
          <Sidebar />
          <TopNav />

          {/* Search overlay */}
          <SearchOverlay />
        </View>
      ) : (
        // Mobile layout
        <View className="relative flex-1 bg-gray-900">
          {/* Full-screen content layer */}
          <SafeAreaView className="flex-1">
            <View
              style={{
                paddingTop: showMobileTopBar ? MOBILE_TOP_BAR_HEIGHT : 0,
                paddingBottom: BOTTOM_TAB_HEIGHT,
              }}
              className="flex-1"
            >
              {children}
            </View>
          </SafeAreaView>

          {/* Navigation layer */}
          <MobileTopBar />
          <BottomTabBar />

          {/* Search overlay */}
          <SearchOverlay />
        </View>
      )}
    </SearchProvider>
  );
}
