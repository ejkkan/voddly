import { useCurrentProfile } from './ui/useCurrentProfile';

export function useProfile() {
  const { currentProfile, isLoading } = useCurrentProfile();
  
  return {
    profile: currentProfile,
    isLoading,
  };
}