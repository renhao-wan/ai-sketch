'use client';

import { LocaleProvider } from '@/lib/locales';
import { SettingsProvider } from '@/hooks/useSettings';
import { NotificationProvider } from '@/lib/contexts/NotificationContext';
import { OnboardingProvider } from '@/components/onboarding/OnboardingProvider';
import { WelcomeModal } from '@/components/onboarding/WelcomeModal';
import { OnboardingOverlay } from '@/components/onboarding/OnboardingOverlay';
import type { ReactNode } from 'react';

export default function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <SettingsProvider>
      <LocaleProvider>
        <NotificationProvider>
          <OnboardingProvider>
            {children}
            <WelcomeModal />
            <OnboardingOverlay />
          </OnboardingProvider>
        </NotificationProvider>
      </LocaleProvider>
    </SettingsProvider>
  );
}
