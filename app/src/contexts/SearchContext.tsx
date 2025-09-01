import React, { createContext, useCallback, useContext, useState } from 'react';

interface SearchContextType {
  searchQuery: string;
  isSearchOpen: boolean;
  setSearchQuery: (query: string) => void;
  setSearchQueryNoOverlay: (query: string) => void;
  openSearch: () => void;
  closeSearch: () => void;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const openSearch = useCallback(() => {
    setIsSearchOpen(true);
  }, []);

  const closeSearch = useCallback(() => {
    setIsSearchOpen(false);
    setSearchQuery('');
  }, []);

  const handleSetSearchQuery = useCallback((query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      setIsSearchOpen(true);
    } else {
      setIsSearchOpen(false);
    }
  }, []);

  const handleSetSearchQueryNoOverlay = useCallback((query: string) => {
    setSearchQuery(query);
    // Don't open overlay when using island search
  }, []);

  return (
    <SearchContext.Provider
      value={{
        searchQuery,
        isSearchOpen,
        setSearchQuery: handleSetSearchQuery,
        setSearchQueryNoOverlay: handleSetSearchQueryNoOverlay,
        openSearch,
        closeSearch,
      }}
    >
      {children}
    </SearchContext.Provider>
  );
}

export function useSearch() {
  const context = useContext(SearchContext);
  if (context === undefined) {
    throw new Error('useSearch must be used within a SearchProvider');
  }
  return context;
}
