// services/api.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_API_URL } from '../constants/config';
import type { BeachSummary, BeachData, WeatherData } from '../types';

let cachedBaseUrl: string | null = null;

async function getBaseUrl(): Promise<string> {
  if (cachedBaseUrl !== null) return cachedBaseUrl;
  const stored = await AsyncStorage.getItem('apiUrl');
  cachedBaseUrl = stored || DEFAULT_API_URL;
  return cachedBaseUrl;
}

async function fetchJson<T>(path: string): Promise<T> {
  const base = await getBaseUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${base}${path}`, { signal: controller.signal });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`API ${res.status} on ${path}: ${body}`);
    }
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

export const api = {
  getBeaches: () => fetchJson<BeachSummary[]>('/api/beaches'),
  getBeach: (slug: string) => fetchJson<BeachData>(`/api/beach/${slug}`),
  getWeather: (slug: string) => fetchJson<WeatherData>(`/api/weather/${slug}`),
};
