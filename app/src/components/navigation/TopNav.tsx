import { BackdropFilter, Blur, Canvas, rect } from '@shopify/react-native-skia';
import { Link, usePathname } from 'expo-router';
import { X } from 'lucide-react-native';
import { MotiView } from 'moti';
import React, { useState } from 'react';
import { Platform, TextInput } from 'react-native';

import { AnimatedIcon, Pressable, Text, View } from '@/components/ui';
import { useSearch } from '@/contexts/SearchContext';
import { useScrollPosition } from '@/hooks/useScrollPosition';
import { type AnimatedIconName } from '@/lib/animated-icons';

import { CONTENT_NAV_ITEMS } from './navigation-types';

export function TopNav() {
  const pathname = usePathname();
  const {
    searchQuery,
    setSearchQuery,
    setSearchQueryNoOverlay,
    isSearchOpen,
    closeSearch,
  } = useSearch();
  const { isAtTop, scrollY } = useScrollPosition();

  console.log('TopNav render - isAtTop:', isAtTop, 'scrollY:', scrollY);

  return (
    <View
      className="fixed top-4 z-[70]"
      style={{
        left: '50%',
        ...(Platform.OS === 'web' && {
          transform: 'translateX(-50%)',
        }),
        marginLeft: Platform.OS !== 'web' ? -300 : 0, // Center for native
        width: 600,
        pointerEvents: 'box-none',
      }}
    >
      <View
        className="overflow-hidden rounded-full"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: Platform.OS === 'web' ? 'blur(20px)' : undefined,
          WebkitBackdropFilter:
            Platform.OS === 'web' ? 'blur(20px)' : undefined,
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.1)',
        }}
      >
        {Platform.OS !== 'web' && (
          <Canvas
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          >
            <BackdropFilter
              filter={<Blur blur={20} />}
              clip={rect(0, 0, 400, 100)}
            />
          </Canvas>
        )}
        <TopNavIsland
          pathname={pathname}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          isSearchOpen={isSearchOpen}
          closeSearch={closeSearch}
          isAtTop={isAtTop}
          scrollY={scrollY}
        />
      </View>
    </View>
  );
}

function TopNavIsland({
  pathname,
  searchQuery,
  setSearchQuery,
  isSearchOpen,
  closeSearch,
  isAtTop,
  scrollY,
}: {
  pathname: string;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isSearchOpen: boolean;
  closeSearch: () => void;
  isAtTop: boolean;
  scrollY: number;
}) {
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

  const getNavIcon = (href: string): AnimatedIconName => {
    switch (href) {
      case '/(app)/dashboard':
        return 'home';
      case '/(app)/movies':
        return 'video';
      case '/(app)/series':
        return 'video2';
      case '/(app)/tv':
        return 'airplay';
      default:
        return 'home';
    }
  };

  const handleSearchPress = () => {
    setIsSearchExpanded(true);
  };

  const handleSearchClose = () => {
    setIsSearchExpanded(false);
    closeSearch();
    setSearchQuery('');
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
  };

  return (
    <View className="flex-row items-center justify-center px-6 py-3">
      {/* Navigation Items */}
      <MotiView
        animate={{
          opacity: isSearchExpanded ? 0 : 1,
          scale: isSearchExpanded ? 0.8 : 1,
        }}
        transition={{
          type: 'spring',
          damping: 15,
          stiffness: 300,
        }}
        style={{ pointerEvents: isSearchExpanded ? 'none' : 'auto' }}
      >
        <View className="flex-row gap-2">
          {CONTENT_NAV_ITEMS.map((item) => {
            const active =
              pathname === item.href ||
              (item.href === '/(app)/dashboard' && pathname === '/(app)');
            const iconName = getNavIcon(item.href);

            return (
              <Link key={item.href} href={item.href} asChild>
                <Pressable
                  className={
                    'rounded-full px-4 py-2.5 flex-row items-center ' +
                    (active ? 'bg-white/20' : 'hover:bg-white/10')
                  }
                >
                  <AnimatedIcon
                    name={iconName}
                    size={18}
                    strokeColor={active ? '#ffffff' : '#9ca3af'}
                    animateOnHover={true}
                    active={active}
                  />
                  <MotiView
                    animate={{
                      opacity: isAtTop ? 1 : 0,
                      width: isAtTop ? 'auto' : 0,
                    }}
                    transition={{
                      type: 'spring',
                      damping: 15,
                      stiffness: 300,
                    }}
                    style={{
                      overflow: 'hidden',
                      marginLeft: isAtTop ? 8 : 0,
                    }}
                  >
                    <Text
                      className={
                        'text-sm font-medium whitespace-nowrap ' +
                        (active ? 'text-white' : 'text-gray-400')
                      }
                    >
                      {item.label}
                    </Text>
                  </MotiView>
                </Pressable>
              </Link>
            );
          })}
        </View>
      </MotiView>

      {/* Divider */}
      {!isSearchExpanded && (
        <MotiView
          animate={{
            opacity: 1,
            width: 1,
          }}
          transition={{
            type: 'spring',
            damping: 15,
            stiffness: 300,
          }}
          className="mx-4 bg-white/20"
          style={{ height: 24 }}
        />
      )}

      {/* Search */}
      {!isSearchExpanded ? (
        <MotiView
          animate={{
            width: 140,
          }}
          transition={{
            type: 'spring',
            damping: 15,
            stiffness: 300,
          }}
          className="flex-row items-center overflow-hidden rounded-full bg-white/10 px-4 py-2.5"
        >
          <Pressable
            onPress={handleSearchPress}
            className="flex-1 flex-row items-center justify-center"
          >
            <AnimatedIcon
              name="searchToX"
              size={18}
              strokeColor="#9ca3af"
              animateOnHover={true}
            />
            <MotiView
              animate={{
                opacity: isAtTop ? 1 : 0,
                width: isAtTop ? 'auto' : 0,
              }}
              transition={{
                type: 'spring',
                damping: 15,
                stiffness: 300,
              }}
              style={{
                overflow: 'hidden',
                marginLeft: isAtTop ? 8 : 0,
              }}
            >
              <Text className="whitespace-nowrap text-sm text-gray-400">
                Search
              </Text>
            </MotiView>
          </Pressable>
        </MotiView>
      ) : (
        <MotiView
          animate={{
            opacity: 1,
          }}
          transition={{
            type: 'timing',
            duration: 200,
            delay: 100,
          }}
          className="absolute inset-0 flex-row items-center px-6 py-3"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            borderRadius: 1000,
          }}
        >
          <AnimatedIcon name="searchToX" size={18} strokeColor="#9ca3af" />
          <TextInput
            value={searchQuery}
            onChangeText={handleSearchChange}
            placeholder="Search movies, series, TV..."
            placeholderTextColor="#9ca3af"
            className="ml-3 flex-1 text-white"
            style={
              {
                outlineStyle: 'none',
                fontSize: 16,
              } as any
            }
            autoFocus
          />
          <Pressable onPress={handleSearchClose} className="ml-6">
            <X size={18} color="#9ca3af" />
          </Pressable>
        </MotiView>
      )}
    </View>
  );
}
