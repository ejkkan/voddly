// Hook for React components
import { useEffect, useState } from 'react';

import { storage } from './storage';

const PROFILE_KEY = 'current_profile_id';

export const profileStore = {
  getCurrentProfileId: (): string | null => {
    return storage.getString(PROFILE_KEY) || null;
  },

  setCurrentProfileId: (profileId: string | null) => {
    if (profileId) {
      storage.set(PROFILE_KEY, profileId);
    } else {
      storage.delete(PROFILE_KEY);
    }
  },

  clearProfile: () => {
    storage.delete(PROFILE_KEY);
  },
};

export function useProfileStore() {
  const [currentProfileId, setCurrentProfileIdState] = useState<string | null>(
    profileStore.getCurrentProfileId()
  );

  useEffect(() => {
    const listener = storage.addOnValueChangedListener((key) => {
      if (key === PROFILE_KEY) {
        setCurrentProfileIdState(profileStore.getCurrentProfileId());
      }
    });

    return () => listener.remove();
  }, []);

  const setCurrentProfileId = (profileId: string | null) => {
    profileStore.setCurrentProfileId(profileId);
    setCurrentProfileIdState(profileId);
  };

  return {
    currentProfileId,
    setCurrentProfileId,
    clearProfile: profileStore.clearProfile,
  };
}
