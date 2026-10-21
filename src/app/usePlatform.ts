import { useQuery } from '@tanstack/react-query';
import { appConfig } from '@/lib/env';
import { fetchPlatformSettings } from '@/repositories/administration';
import type { PlatformSettings } from '@/types/domain';

export const DEFAULT_PLATFORM: PlatformSettings = {
  platform_name: 'Réussite Scolaire CI',
  slogan: 'Apprendre, s’entraîner, réussir',
  mastery_threshold: 80,
};

/** Nom et slogan configurables depuis l'administration (valeurs par défaut hors ligne). */
export function usePlatform(): PlatformSettings {
  const q = useQuery({
    queryKey: ['platform-settings'],
    queryFn: fetchPlatformSettings,
    enabled: appConfig.configured,
    staleTime: 30 * 60_000,
    retry: 1,
  });
  return q.data ?? DEFAULT_PLATFORM;
}
