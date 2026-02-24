import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../services/api';
import type { BeachSummary, BeachData, WeatherData, UserPrefs } from '../types';

interface AppState {
  beaches: BeachSummary[];
  selectedSlug: string;
  homeSpot: string;
  beachData: BeachData | null;
  weatherData: WeatherData | null;
  prefs: UserPrefs;
  loading: boolean;
  error: string | null;
  selectBeach: (slug: string) => void;
  setHomeSpot: (slug: string) => void;
  updatePrefs: (prefs: UserPrefs) => void;
  refresh: () => Promise<void>;
}

const defaultPrefs: UserPrefs = {
  skill: 'intermediate',
  minWave: 1,
  maxWave: 6,
  cold: 'moderate',
};

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [beaches, setBeaches] = useState<BeachSummary[]>([]);
  const [selectedSlug, setSelectedSlug] = useState('wrightsville');
  const [homeSpot, setHomeSpotState] = useState('wrightsville');
  const [beachData, setBeachData] = useState<BeachData | null>(null);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [prefs, setPrefs] = useState<UserPrefs>(defaultPrefs);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Load persisted settings on mount
  useEffect(() => {
    (async () => {
      try {
        const [storedHome, storedPrefs] = await Promise.all([
          AsyncStorage.getItem('homeSpot'),
          AsyncStorage.getItem('surfPrefs'),
        ]);
        if (storedHome) {
          setHomeSpotState(storedHome);
          setSelectedSlug(storedHome);
        }
        if (storedPrefs) setPrefs(JSON.parse(storedPrefs));
      } catch {
        // Ignore storage errors on mount
      } finally {
        setInitialized(true);
      }
    })();
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [beachesList, beach, weather] = await Promise.all([
        api.getBeaches(),
        api.getBeach(selectedSlug),
        api.getWeather(selectedSlug),
      ]);
      setBeaches(beachesList);
      setBeachData(beach);
      setWeatherData(weather);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to connect to server');
    } finally {
      setLoading(false);
    }
  }, [selectedSlug]);

  // Refresh when initialized or selected beach changes
  useEffect(() => {
    if (initialized) refresh();
  }, [initialized, refresh]);

  const selectBeach = useCallback((slug: string) => setSelectedSlug(slug), []);

  const setHomeSpot = useCallback(async (slug: string) => {
    setHomeSpotState(slug);
    try { await AsyncStorage.setItem('homeSpot', slug); } catch {}
  }, []);

  const updatePrefs = useCallback(async (newPrefs: UserPrefs) => {
    setPrefs(newPrefs);
    try { await AsyncStorage.setItem('surfPrefs', JSON.stringify(newPrefs)); } catch {}
  }, []);

  const value = useMemo(() => ({
    beaches, selectedSlug, homeSpot, beachData, weatherData,
    prefs, loading, error, selectBeach, setHomeSpot, updatePrefs, refresh,
  }), [beaches, selectedSlug, homeSpot, beachData, weatherData,
       prefs, loading, error, selectBeach, setHomeSpot, updatePrefs, refresh]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
