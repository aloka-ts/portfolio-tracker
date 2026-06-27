import { atom } from 'nanostores';
import type { UserSettings } from '../types';

const DEFAULT_SETTINGS: UserSettings = {
  currency: 'INR',
  decimals: 2,
  colorblind: false,
  density: 'comfortable',
  provider: 'google',
  pollingFreq: 5, // 5 seconds
};

// Check if localStorage is available (browser side)
const isBrowser = typeof window !== 'undefined';

function loadInitialSettings(): UserSettings {
  if (!isBrowser) return DEFAULT_SETTINGS;
  try {
    const saved = localStorage.getItem('portfolio_settings');
    if (saved) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.error('Failed to load settings from localStorage', e);
  }
  return DEFAULT_SETTINGS;
}

export const settingsStore = atom<UserSettings>(loadInitialSettings());

export function updateSettings(updates: Partial<UserSettings>) {
  const current = settingsStore.get();
  const next = { ...current, ...updates };
  settingsStore.set(next);
  if (isBrowser) {
    try {
      localStorage.setItem('portfolio_settings', JSON.stringify(next));
    } catch (e) {
      console.error('Failed to save settings', e);
    }
  }
}
