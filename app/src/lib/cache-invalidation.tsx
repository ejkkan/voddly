'use client';

import { useQueryClient } from '@tanstack/react-query';
import React, { createContext, useCallback, useContext } from 'react';

import { clearXtreamClientCache } from '@/hooks/useXtream';

type CacheInvalidationContextType = {
  invalidateAfterPassphrase: (accountId: string, sourceId?: string) => void;
};

const CacheInvalidationContext = createContext<CacheInvalidationContextType | null>(null);

export function CacheInvalidationProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();

  const invalidateAfterPassphrase = useCallback((accountId: string, sourceId?: string) => {
    console.log('[CacheInvalidation] Invalidating caches after passphrase success', { accountId, sourceId });
    
    // Clear XtreamClient cache for the specific source or all sources
    clearXtreamClientCache(sourceId);
    
    // Invalidate all React Query caches related to the source/account
    if (sourceId) {
      // Invalidate specific source queries
      queryClient.invalidateQueries({ queryKey: ['xtream', 'catalog', sourceId] });
      queryClient.invalidateQueries({ 
        queryKey: ['xtream', 'category'], 
        predicate: (query) => query.queryKey.includes(sourceId)
      });
      queryClient.invalidateQueries({ 
        queryKey: ['xtream', 'movie'], 
        predicate: (query) => query.queryKey.includes(sourceId)
      });
      queryClient.invalidateQueries({ 
        queryKey: ['xtream', 'series'], 
        predicate: (query) => query.queryKey.includes(sourceId)
      });
      queryClient.invalidateQueries({ 
        queryKey: ['xtream', 'epg'], 
        predicate: (query) => query.queryKey.includes(sourceId)
      });
      queryClient.invalidateQueries({ 
        queryKey: ['channel-epg'], 
        predicate: (query) => query.queryKey.includes(sourceId)
      });
    } else {
      // Invalidate all xtream and EPG queries
      queryClient.invalidateQueries({ queryKey: ['xtream'] });
      queryClient.invalidateQueries({ queryKey: ['channel-epg'] });
    }
    
    // Invalidate UI sections and dashboard data that might be affected
    queryClient.invalidateQueries({ queryKey: ['ui-sections'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['epg'] });
    queryClient.invalidateQueries({ queryKey: ['sources'] });
    queryClient.invalidateQueries({ queryKey: ['catalog'] });
    queryClient.invalidateQueries({ queryKey: ['categories'] });
    
    console.log('[CacheInvalidation] Cache invalidation completed');
  }, [queryClient]);

  const contextValue = { invalidateAfterPassphrase };

  return (
    <CacheInvalidationContext.Provider value={contextValue}>
      {children}
    </CacheInvalidationContext.Provider>
  );
}

export function useCacheInvalidation() {
  const context = useContext(CacheInvalidationContext);
  if (!context) {
    throw new Error('useCacheInvalidation must be used within CacheInvalidationProvider');
  }
  return context;
}