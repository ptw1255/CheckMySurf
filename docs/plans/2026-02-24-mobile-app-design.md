# CheckMySurf Mobile App Design

**Date:** 2026-02-24
**Status:** Approved

## Overview

Native iOS app built with React Native + Expo. Full feature parity with the web dashboard — beach summary, beach switching, surf quality, timeline, forecast, home spot, and preferences. Consumes the existing ASP.NET backend API. Personal use only (no App Store).

## Approach

React Native with Expo (Approach 1). JavaScript/TypeScript app using Expo Router for navigation. Run on iPhone via Expo Go during development, or build with Xcode for a standalone install.

## Project Structure

```
CheckMySurf-mobile/              # Separate directory alongside web app
  app/                           # Expo Router screens
    (tabs)/
      index.tsx                  # Beach summary (home screen)
      [slug].tsx                 # Full beach detail view
      settings.tsx               # Preferences
  components/                    # Reusable UI components
  services/
    api.ts                       # API client (fetch from backend)
  constants/
    config.ts                    # API base URL, beach colors, etc.
  app.json                       # Expo config
  package.json
```

Separate from the .NET project — the mobile app is a pure API consumer.

## Screens & Navigation

Tab-based navigation with 3 tabs:

### Tab 1: Beaches (home)
- Summary cards for all 4 beaches with colored indicator (red/yellow/green), wave height, quality label
- Star icon for home spot (AsyncStorage)
- Tap a card to navigate to detail view

### Tab 2: Detail (default shows home spot)
- Full dashboard for one beach: weather hero card, surf hero card with quality gauge, hourly timeline (horizontal scroll), 5-day forecast, daily surf forecast
- Swipe left/right to switch between beaches
- Pull-to-refresh

### Tab 3: Settings
- Surf preferences: skill level, min/max wave height, cold tolerance
- API URL config (localhost during dev, server URL later)
- Home spot selection

App launches to Tab 1 with home spot's detail pre-loaded on Tab 2.

## API Integration

- Base URL configurable (defaults to `http://localhost:5103`)
- Three fetch functions:
  - `getBeaches()` → `GET /api/beaches`
  - `getBeach(slug)` → `GET /api/beach/{slug}`
  - `getWeather(slug)` → `GET /api/weather/{slug}`
- No auth — endpoints are public
- Error handling: "Can't connect to server" message if unreachable

## State Management

- React Context for selected beach and beaches list (no Redux)
- AsyncStorage for persisted settings (home spot, preferences, API URL)
- No local caching beyond React state — backend handles caching
- Pull-to-refresh on detail screen, refresh-on-focus for summary screen
- No background polling

## What We're NOT Building

- No push notifications
- No offline mode
- No user accounts
- No App Store submission prep
- No Android build
- No changes to existing web app or backend API
