# CheckMySurf Mobile App Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an iOS app with React Native + Expo that mirrors the web dashboard, consuming the existing backend API.

**Architecture:** Expo Router tab navigation with 3 tabs (Beaches, Detail, Settings). API client fetches from the ASP.NET backend. React Context for state, AsyncStorage for persistence. Dark theme matching the web app.

**Tech Stack:** React Native, Expo (SDK 52+), Expo Router, TypeScript, AsyncStorage

**Design doc:** `docs/plans/2026-02-24-mobile-app-design.md`

**Prerequisites:**
- Backend running at `http://localhost:5103` (or accessible server URL)
- Node.js v24+ (already installed)
- Xcode installed (for iOS Simulator) or Expo Go on your iPhone

---

### Task 1: Scaffold the Expo project

**Files:**
- Create: `CheckMySurf-mobile/` (entire project via `npm create expo`)

**Step 1: Create the project using the tabs template**

```bash
cd /Users/parker/VSCode
npm create expo -t tabs CheckMySurf-mobile
```

Follow prompts — accept defaults. This generates the full Expo Router tabs scaffold.

**Step 2: Verify it runs**

```bash
cd /Users/parker/VSCode/CheckMySurf-mobile
npx expo start --ios
```

Expected: iOS Simulator launches with the default tabs app.

**Step 3: Clean out the template boilerplate**

Delete all template screen content but keep the file structure:
- `app/(tabs)/index.tsx` — clear to a simple "Beaches" placeholder
- `app/(tabs)/explore.tsx` — rename to `detail.tsx`, clear to "Detail" placeholder
- `app/(tabs)/_layout.tsx` — update tab names/icons

**Step 4: Commit**

```bash
cd /Users/parker/VSCode/CheckMySurf-mobile
git init
git add -A
git commit -m "chore: scaffold Expo project from tabs template"
```

---

### Task 2: Set up the API client and types

**Files:**
- Create: `CheckMySurf-mobile/services/api.ts`
- Create: `CheckMySurf-mobile/types/index.ts`
- Create: `CheckMySurf-mobile/constants/config.ts`

**Step 1: Create the config file**

```typescript
// constants/config.ts
export const DEFAULT_API_URL = 'http://localhost:5103';
```

**Step 2: Create TypeScript types matching the backend API**

```typescript
// types/index.ts
export interface BeachSummary {
  slug: string;
  name: string;
  weatherCity: string;
  qualityScore: number;
  surfRating: string;
  waveHeightFt: number;
  ratingColor: 'red' | 'yellow' | 'green';
}

export interface WeatherData {
  currentTempF: number;
  condition: string;
  conditionIcon: string;
  windMph: number;
  humidityPct: number;
  daily: DailyForecast[];
}

export interface DailyForecast {
  date: string;
  highF: number;
  lowF: number;
  condition: string;
  conditionIcon: string;
}

export interface BeachData {
  seaTempF: number;
  waveHeightFt: number;
  wavePeriodS: number;
  swellDirection: string;
  surfRating: string;
  qualityScore: number;
  hourly: HourlySurf[];
  daily: DailySurf[];
}

export interface HourlySurf {
  time: string;
  waveHeightFt: number;
  wavePeriodS: number;
  swellDirection: string;
  surfRating: string;
  qualityScore: number;
}

export interface DailySurf {
  date: string;
  waveHeightFt: number;
  wavePeriodS: number;
  swellDirection: string;
  surfRating: string;
  qualityScore: number;
}

export interface UserPrefs {
  skill: 'beginner' | 'intermediate' | 'advanced';
  minWave: number;
  maxWave: number;
  cold: 'cold-averse' | 'moderate' | 'tough';
}
```

**Step 3: Create the API client**

```typescript
// services/api.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_API_URL } from '../constants/config';
import type { BeachSummary, BeachData, WeatherData } from '../types';

async function getBaseUrl(): Promise<string> {
  const stored = await AsyncStorage.getItem('apiUrl');
  return stored || DEFAULT_API_URL;
}

async function fetchJson<T>(path: string): Promise<T> {
  const base = await getBaseUrl();
  const res = await fetch(`${base}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export const api = {
  getBeaches: () => fetchJson<BeachSummary[]>('/api/beaches'),
  getBeach: (slug: string) => fetchJson<BeachData>(`/api/beach/${slug}`),
  getWeather: (slug: string) => fetchJson<WeatherData>(`/api/weather/${slug}`),
};
```

**Step 4: Install AsyncStorage**

```bash
npx expo install @react-native-async-storage/async-storage
```

**Step 5: Verify it compiles**

```bash
npx expo start --ios
```

Expected: App still runs (API client isn't called yet, just importable).

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add API client, types, and config"
```

---

### Task 3: Create the App Context (state management)

**Files:**
- Create: `CheckMySurf-mobile/context/AppContext.tsx`
- Modify: `CheckMySurf-mobile/app/_layout.tsx`

**Step 1: Create the context provider**

```typescript
// context/AppContext.tsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
      } catch {}
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
    } catch (e: any) {
      setError(e.message || 'Failed to connect to server');
    } finally {
      setLoading(false);
    }
  }, [selectedSlug]);

  // Refresh when selected beach changes
  useEffect(() => { refresh(); }, [refresh]);

  const selectBeach = (slug: string) => setSelectedSlug(slug);

  const setHomeSpot = async (slug: string) => {
    setHomeSpotState(slug);
    await AsyncStorage.setItem('homeSpot', slug);
  };

  const updatePrefs = async (newPrefs: UserPrefs) => {
    setPrefs(newPrefs);
    await AsyncStorage.setItem('surfPrefs', JSON.stringify(newPrefs));
  };

  return (
    <AppContext.Provider value={{
      beaches, selectedSlug, homeSpot, beachData, weatherData,
      prefs, loading, error, selectBeach, setHomeSpot, updatePrefs, refresh,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
```

**Step 2: Wrap the app in the provider**

Modify `app/_layout.tsx`:

```typescript
import { Stack } from 'expo-router';
import { AppProvider } from '../context/AppContext';

export default function RootLayout() {
  return (
    <AppProvider>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </AppProvider>
  );
}
```

**Step 3: Verify it runs**

```bash
npx expo start --ios
```

Expected: App launches, context loads, attempts to fetch from API (may show error if backend isn't running — that's fine).

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add AppContext with state management and persistence"
```

---

### Task 4: Build the Beaches tab (home screen)

**Files:**
- Modify: `CheckMySurf-mobile/app/(tabs)/index.tsx`
- Modify: `CheckMySurf-mobile/app/(tabs)/_layout.tsx`
- Create: `CheckMySurf-mobile/components/BeachCard.tsx`
- Create: `CheckMySurf-mobile/constants/theme.ts`

**Step 1: Create the theme constants**

```typescript
// constants/theme.ts
export const colors = {
  bg: '#0f172a',
  cardBg: 'rgba(255,255,255,0.06)',
  cardBorder: 'rgba(255,255,255,0.08)',
  text: '#e2e8f0',
  textMuted: '#94a3b8',
  textDim: '#64748b',
  blue: '#60a5fa',
  green: '#22c55e',
  yellow: '#eab308',
  red: '#ef4444',
  purple: '#a78bfa',
};

export const ratingColors: Record<string, string> = {
  green: colors.green,
  yellow: colors.yellow,
  red: colors.red,
};

export function scoreColor(score: number): string {
  if (score < 10) return '#64748b';
  if (score < 25) return '#f87171';
  if (score < 40) return '#fb923c';
  if (score < 55) return '#fbbf24';
  if (score < 70) return '#4ade80';
  if (score < 85) return '#34d399';
  if (score < 95) return '#a78bfa';
  return '#ec4899';
}
```

**Step 2: Create the BeachCard component**

```typescript
// components/BeachCard.tsx
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, ratingColors } from '../constants/theme';
import type { BeachSummary } from '../types';

interface Props {
  beach: BeachSummary;
  isActive: boolean;
  isHome: boolean;
  onPress: () => void;
  onStar: () => void;
}

export function BeachCard({ beach, isActive, isHome, onPress, onStar }: Props) {
  return (
    <Pressable
      style={[styles.card, isActive && styles.active]}
      onPress={onPress}
    >
      <View style={[styles.dot, { backgroundColor: ratingColors[beach.ratingColor] || colors.red }]} />
      <View style={styles.info}>
        <Text style={styles.name}>{beach.name}</Text>
        <Text style={styles.stats}>{beach.waveHeightFt}ft · {beach.surfRating}</Text>
      </View>
      <Pressable onPress={onStar} hitSlop={8}>
        <Text style={[styles.star, isHome && styles.starred]}>
          {isHome ? '★' : '☆'}
        </Text>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 16,
    marginBottom: 10,
  },
  active: {
    borderColor: 'rgba(59,130,246,0.5)',
    backgroundColor: 'rgba(59,130,246,0.1)',
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  info: { flex: 1 },
  name: { color: colors.text, fontSize: 16, fontWeight: '600' },
  stats: { color: colors.textDim, fontSize: 13, marginTop: 2 },
  star: { fontSize: 22, color: colors.textDim, opacity: 0.3 },
  starred: { color: '#fbbf24', opacity: 1 },
});
```

**Step 3: Build the Beaches screen**

```typescript
// app/(tabs)/index.tsx
import { View, Text, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '../../context/AppContext';
import { BeachCard } from '../../components/BeachCard';
import { colors } from '../../constants/theme';

export default function BeachesScreen() {
  const { beaches, selectedSlug, homeSpot, selectBeach, setHomeSpot, refresh, loading, error } = useApp();
  const router = useRouter();

  const handlePress = (slug: string) => {
    selectBeach(slug);
    router.push('/(tabs)/detail');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>CheckMySurf</Text>
      <Text style={styles.subtitle}>NC Beach Conditions</Text>
      {error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={beaches}
        keyExtractor={(b) => b.slug}
        renderItem={({ item }) => (
          <BeachCard
            beach={item}
            isActive={item.slug === selectedSlug}
            isHome={item.slug === homeSpot}
            onPress={() => handlePress(item.slug)}
            onStar={() => setHomeSpot(item.slug)}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.blue} />
        }
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  title: { color: colors.text, fontSize: 28, fontWeight: '300', textAlign: 'center', marginTop: 60, letterSpacing: -0.5 },
  subtitle: { color: colors.blue, fontSize: 14, textAlign: 'center', marginTop: 4, marginBottom: 20 },
  error: { color: colors.red, textAlign: 'center', padding: 16, fontSize: 14 },
  list: { padding: 16 },
});
```

**Step 4: Update the tab layout**

```typescript
// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../../constants/theme';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: { backgroundColor: colors.bg, borderTopColor: 'rgba(255,255,255,0.08)' },
      tabBarActiveTintColor: colors.blue,
      tabBarInactiveTintColor: colors.textDim,
    }}>
      <Tabs.Screen name="index" options={{
        title: 'Beaches',
        tabBarIcon: ({ color, focused }) => (
          <Ionicons name={focused ? 'water' : 'water-outline'} color={color} size={24} />
        ),
      }} />
      <Tabs.Screen name="detail" options={{
        title: 'Detail',
        tabBarIcon: ({ color, focused }) => (
          <Ionicons name={focused ? 'analytics' : 'analytics-outline'} color={color} size={24} />
        ),
      }} />
      <Tabs.Screen name="settings" options={{
        title: 'Settings',
        tabBarIcon: ({ color, focused }) => (
          <Ionicons name={focused ? 'settings' : 'settings-outline'} color={color} size={24} />
        ),
      }} />
    </Tabs>
  );
}
```

**Step 5: Verify in simulator**

```bash
npx expo start --ios
```

Expected: Beaches tab shows 4 beach cards with colored dots, star icons, pull-to-refresh.

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: build Beaches tab with beach cards and home spot"
```

---

### Task 5: Build the Detail tab

**Files:**
- Create: `CheckMySurf-mobile/app/(tabs)/detail.tsx`
- Create: `CheckMySurf-mobile/components/QualityGauge.tsx`
- Create: `CheckMySurf-mobile/components/HourlyTimeline.tsx`
- Create: `CheckMySurf-mobile/components/WeatherCard.tsx`
- Create: `CheckMySurf-mobile/components/SurfCard.tsx`

**Step 1: Create WeatherCard component**

```typescript
// components/WeatherCard.tsx
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../constants/theme';
import type { WeatherData } from '../types';

const conditionIcons: Record<string, string> = {
  'clear': '☀️', 'partly-cloudy': '⛅', 'overcast': '☁️',
  'fog': '🌫️', 'drizzle': '🌦️', 'rain': '🌧️',
  'freezing-rain': '🧊', 'snow': '❄️',
  'thunderstorm': '⛈️', 'unknown': '🌤️',
};

interface Props {
  weather: WeatherData;
  cityName: string;
}

export function WeatherCard({ weather, cityName }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{cityName} — Now</Text>
      <View style={styles.row}>
        <Text style={styles.icon}>{conditionIcons[weather.conditionIcon] || '🌤️'}</Text>
        <View>
          <Text style={styles.temp}>{Math.round(weather.currentTempF)}°</Text>
          <Text style={styles.condition}>{weather.condition}</Text>
        </View>
      </View>
      <View style={styles.detailRow}>
        <Text style={styles.detail}>💨 {weather.windMph} mph</Text>
        <Text style={styles.detail}>💧 {weather.humidityPct}%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 20, padding: 20, marginBottom: 12 },
  label: { color: colors.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  icon: { fontSize: 40 },
  temp: { color: colors.text, fontSize: 42, fontWeight: '600' },
  condition: { color: colors.textMuted, fontSize: 15, marginTop: 2 },
  detailRow: { flexDirection: 'row', gap: 20, marginTop: 14 },
  detail: { color: colors.textDim, fontSize: 13 },
});
```

**Step 2: Create QualityGauge component**

```typescript
// components/QualityGauge.tsx
import { View, Text, StyleSheet } from 'react-native';
import { colors, scoreColor } from '../constants/theme';

interface Props {
  score: number;
  rating: string;
}

export function QualityGauge({ score, rating }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>Surf Quality</Text>
        <Text style={[styles.score, { color: scoreColor(score) }]}>{score}<Text style={styles.max}>/100</Text></Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.needle, { left: `${score}%` }]} />
      </View>
      <View style={styles.labels}>
        <Text style={styles.rangeLabel}>Flat</Text>
        <Text style={styles.rangeLabel}>Poor</Text>
        <Text style={styles.rangeLabel}>Fair</Text>
        <Text style={styles.rangeLabel}>Good</Text>
        <Text style={styles.rangeLabel}>Epic</Text>
      </View>
      <Text style={[styles.ratingText, { color: scoreColor(score) }]}>{rating}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 12 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 },
  label: { color: colors.textDim, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },
  score: { fontSize: 20, fontWeight: '700' },
  max: { fontSize: 11, color: colors.textDim },
  track: { height: 10, borderRadius: 5, backgroundColor: colors.textDim, position: 'relative' },
  needle: { position: 'absolute', top: -4, width: 4, height: 18, backgroundColor: '#fff', borderRadius: 2 },
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  rangeLabel: { color: colors.textDim, fontSize: 10 },
  ratingText: { fontSize: 15, fontWeight: '600', marginTop: 6 },
});
```

**Step 3: Create HourlyTimeline component**

```typescript
// components/HourlyTimeline.tsx
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { colors, scoreColor } from '../constants/theme';
import type { HourlySurf } from '../types';

interface Props {
  hourly: HourlySurf[];
}

function fmtHour(timeStr: string): string {
  const d = new Date(timeStr);
  const h = d.getHours();
  const now = new Date();
  if (d.getHours() === now.getHours() && d.toDateString() === now.toDateString()) return 'Now';
  if (h === 0) return '12a';
  if (h < 12) return h + 'a';
  if (h === 12) return '12p';
  return (h - 12) + 'p';
}

export function HourlyTimeline({ hourly }: Props) {
  const now = new Date();
  const currentHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours()).getTime();
  const startIdx = hourly.findIndex(h => new Date(h.time).getTime() >= currentHour);
  const hours = hourly.slice(Math.max(startIdx, 0), Math.max(startIdx, 0) + 24);
  const maxWave = Math.max(...hours.map(h => h.waveHeightFt), 1);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Surf Timeline</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {hours.map((h, i) => {
          const barPct = Math.round((h.waveHeightFt / maxWave) * 100);
          const clr = scoreColor(h.qualityScore);
          return (
            <View key={i} style={styles.hour}>
              <Text style={styles.time}>{fmtHour(h.time)}</Text>
              <View style={styles.barWrap}>
                <View style={[styles.bar, { height: `${Math.max(barPct, 8)}%`, backgroundColor: clr }]} />
              </View>
              <Text style={[styles.wave, { color: clr }]}>{h.waveHeightFt}'</Text>
              <Text style={styles.period}>{h.wavePeriodS}s</Text>
              <Text style={styles.dir}>{h.swellDirection}</Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 16, padding: 16, marginBottom: 12 },
  title: { color: colors.textDim, fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12 },
  scroll: { gap: 2 },
  hour: { alignItems: 'center', width: 48, paddingVertical: 4 },
  time: { color: colors.textDim, fontSize: 11, marginBottom: 6 },
  barWrap: { width: 24, height: 70, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'flex-end', overflow: 'hidden' },
  bar: { width: '100%', borderRadius: 12 },
  wave: { fontSize: 11, fontWeight: '600', marginTop: 4 },
  period: { color: colors.textDim, fontSize: 10 },
  dir: { color: colors.textDim, fontSize: 10 },
});
```

**Step 4: Create SurfCard component (for daily forecast)**

```typescript
// components/SurfCard.tsx
import { View, Text, StyleSheet } from 'react-native';
import { colors, scoreColor } from '../constants/theme';
import type { DailySurf } from '../types';

const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

interface Props {
  surf: DailySurf;
}

export function SurfCard({ surf }: Props) {
  const d = new Date(surf.date + 'T00:00:00');
  const day = dayNames[d.getDay()];
  return (
    <View style={styles.card}>
      <Text style={styles.day}>{day}</Text>
      <Text style={styles.wave}>{surf.waveHeightFt} ft</Text>
      <Text style={styles.detail}>{surf.wavePeriodS}s · {surf.swellDirection}</Text>
      <Text style={[styles.rating, { color: scoreColor(surf.qualityScore) }]}>
        {surf.surfRating} {surf.qualityScore}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 16, padding: 14, alignItems: 'center', flex: 1 },
  day: { color: colors.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6 },
  wave: { color: colors.text, fontSize: 18, fontWeight: '600' },
  detail: { color: colors.textDim, fontSize: 11, marginTop: 4 },
  rating: { fontSize: 11, fontWeight: '600', marginTop: 6 },
});
```

**Step 5: Build the Detail screen**

```typescript
// app/(tabs)/detail.tsx
import { View, Text, ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { useApp } from '../../context/AppContext';
import { WeatherCard } from '../../components/WeatherCard';
import { QualityGauge } from '../../components/QualityGauge';
import { HourlyTimeline } from '../../components/HourlyTimeline';
import { SurfCard } from '../../components/SurfCard';
import { colors } from '../../constants/theme';

export default function DetailScreen() {
  const { beaches, selectedSlug, beachData, weatherData, loading, error, refresh } = useApp();
  const beachInfo = beaches.find(b => b.slug === selectedSlug);
  const beachName = beachInfo?.name || selectedSlug;
  const weatherCity = beachInfo?.weatherCity || beachName;

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  if (!beachData || !weatherData) {
    return (
      <View style={styles.center}>
        <Text style={styles.loading}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.blue} />}
    >
      <Text style={styles.title}>{beachName}</Text>

      <WeatherCard weather={weatherData} cityName={weatherCity} />

      <View style={styles.surfCard}>
        <Text style={styles.label}>Surf</Text>
        <Text style={styles.waveText}>🌊 {beachData.waveHeightFt} ft <Text style={styles.waveSub}>@ {beachData.wavePeriodS}s from {beachData.swellDirection}</Text></Text>
        <Text style={styles.seaTemp}>Sea Temp: {Math.round(beachData.seaTempF)}°F</Text>
        <QualityGauge score={beachData.qualityScore} rating={beachData.surfRating} />
      </View>

      <HourlyTimeline hourly={beachData.hourly} />

      <Text style={styles.sectionTitle}>Daily Surf Forecast</Text>
      <View style={styles.dailyRow}>
        {beachData.daily.map((d, i) => (
          <SurfCard key={i} surf={d} />
        ))}
      </View>

      <Text style={styles.sectionTitle}>5-Day Weather</Text>
      {weatherData.daily.map((d, i) => {
        const date = new Date(d.date + 'T00:00:00');
        const dayName = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][date.getDay()];
        return (
          <View key={i} style={styles.forecastRow}>
            <Text style={styles.forecastDay}>{dayName}</Text>
            <Text style={styles.forecastCondition}>{d.condition}</Text>
            <Text style={styles.forecastTemps}>{Math.round(d.highF)}° / {Math.round(d.lowF)}°</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingTop: 60 },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  loading: { color: colors.textDim, fontSize: 16 },
  error: { color: colors.red, fontSize: 14, padding: 20, textAlign: 'center' },
  title: { color: colors.text, fontSize: 24, fontWeight: '300', textAlign: 'center', marginBottom: 20 },
  surfCard: { backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 20, padding: 20, marginBottom: 12 },
  label: { color: colors.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 },
  waveText: { color: colors.text, fontSize: 20, fontWeight: '600' },
  waveSub: { color: colors.textDim, fontSize: 14, fontWeight: '400' },
  seaTemp: { color: colors.text, fontSize: 16, marginTop: 8 },
  sectionTitle: { color: colors.textDim, fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, marginTop: 8, marginBottom: 12 },
  dailyRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  forecastRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  forecastDay: { color: colors.text, fontSize: 14, fontWeight: '600', width: 40 },
  forecastCondition: { color: colors.textMuted, fontSize: 14, flex: 1 },
  forecastTemps: { color: colors.text, fontSize: 14 },
});
```

**Step 6: Verify in simulator**

```bash
npx expo start --ios
```

Expected: Tapping a beach card on Tab 1 navigates to Tab 2 showing full surf detail, weather, timeline, forecasts. Pull-to-refresh works.

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: build Detail tab with weather, surf, timeline, and forecasts"
```

---

### Task 6: Build the Settings tab

**Files:**
- Create: `CheckMySurf-mobile/app/(tabs)/settings.tsx`

**Step 1: Build the Settings screen**

```typescript
// app/(tabs)/settings.tsx
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Slider from '@react-native-community/slider';
import { useApp } from '../../context/AppContext';
import { colors } from '../../constants/theme';

export default function SettingsScreen() {
  const { prefs, updatePrefs, beaches, homeSpot, setHomeSpot } = useApp();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings</Text>

      <Text style={styles.sectionTitle}>Home Spot</Text>
      <View style={styles.pickerWrap}>
        <Picker
          selectedValue={homeSpot}
          onValueChange={setHomeSpot}
          style={styles.picker}
          itemStyle={styles.pickerItem}
        >
          {beaches.map(b => (
            <Picker.Item key={b.slug} label={b.name} value={b.slug} />
          ))}
        </Picker>
      </View>

      <Text style={styles.sectionTitle}>Surf Preferences</Text>

      <Text style={styles.label}>Skill Level</Text>
      <View style={styles.pickerWrap}>
        <Picker
          selectedValue={prefs.skill}
          onValueChange={(v) => updatePrefs({ ...prefs, skill: v })}
          style={styles.picker}
          itemStyle={styles.pickerItem}
        >
          <Picker.Item label="Beginner" value="beginner" />
          <Picker.Item label="Intermediate" value="intermediate" />
          <Picker.Item label="Advanced" value="advanced" />
        </Picker>
      </View>

      <Text style={styles.label}>Min Wave Height: {prefs.minWave} ft</Text>
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={8}
        step={0.5}
        value={prefs.minWave}
        onSlidingComplete={(v) => updatePrefs({ ...prefs, minWave: v })}
        minimumTrackTintColor={colors.blue}
        maximumTrackTintColor={colors.textDim}
        thumbTintColor={colors.blue}
      />

      <Text style={styles.label}>Max Wave Height: {prefs.maxWave} ft</Text>
      <Slider
        style={styles.slider}
        minimumValue={1}
        maximumValue={12}
        step={0.5}
        value={prefs.maxWave}
        onSlidingComplete={(v) => updatePrefs({ ...prefs, maxWave: v })}
        minimumTrackTintColor={colors.blue}
        maximumTrackTintColor={colors.textDim}
        thumbTintColor={colors.blue}
      />

      <Text style={styles.label}>Cold Tolerance</Text>
      <View style={styles.pickerWrap}>
        <Picker
          selectedValue={prefs.cold}
          onValueChange={(v) => updatePrefs({ ...prefs, cold: v })}
          style={styles.picker}
          itemStyle={styles.pickerItem}
        >
          <Picker.Item label="Cold Averse (prefer > 65°F)" value="cold-averse" />
          <Picker.Item label="Moderate (fine > 55°F)" value="moderate" />
          <Picker.Item label="Tough (anything goes)" value="tough" />
        </Picker>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingTop: 60 },
  title: { color: colors.text, fontSize: 24, fontWeight: '300', textAlign: 'center', marginBottom: 24 },
  sectionTitle: { color: colors.textDim, fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, marginTop: 16, marginBottom: 8 },
  label: { color: colors.textMuted, fontSize: 14, marginTop: 12, marginBottom: 4 },
  pickerWrap: { backgroundColor: colors.cardBg, borderRadius: 12, borderWidth: 1, borderColor: colors.cardBorder, overflow: 'hidden' },
  picker: { color: colors.text },
  pickerItem: { color: colors.text, fontSize: 16 },
  slider: { width: '100%', height: 40, marginTop: 4 },
});
```

**Step 2: Install picker and slider dependencies**

```bash
npx expo install @react-native-picker/picker @react-native-community/slider
```

**Step 3: Verify in simulator**

```bash
npx expo start --ios
```

Expected: Settings tab shows home spot picker, skill level, wave height sliders, cold tolerance. Changes persist after app restart.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: build Settings tab with preferences and home spot"
```

---

### Task 7: Final polish and verification

**Step 1: Update app.json with app name and scheme**

In `app.json`, update:
```json
{
  "expo": {
    "name": "CheckMySurf",
    "slug": "CheckMySurf",
    "scheme": "checkmysurf"
  }
}
```

**Step 2: Full manual verification**

Run: `npx expo start --ios`

Checklist:
- [ ] Beaches tab shows 4 beach cards with colored dots
- [ ] Tapping a card switches to Detail tab with that beach's data
- [ ] Star icon sets home spot (persists after restart)
- [ ] Detail tab shows weather, surf quality gauge, hourly timeline, daily surf, 5-day weather
- [ ] Pull-to-refresh works on both tabs
- [ ] Settings tab: skill, wave heights, cold tolerance all save correctly
- [ ] Home spot picker works
- [ ] App handles backend being offline gracefully (shows error message)

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: final polish - app name and verification"
```
