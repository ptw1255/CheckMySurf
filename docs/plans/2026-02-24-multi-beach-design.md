# Multi-Beach Support Design

**Date:** 2026-02-24
**Status:** Approved

## Overview

Expand the dashboard from a single hardcoded beach (Wrightsville) to support 4 NC beaches: Wrightsville Beach, Carolina Beach, Kure Beach, and Surf City. Each beach gets its own weather and surf data, with a summary bar for at-a-glance comparison and a "home spot" feature.

## Approach

Beach Registry in Program.cs (Approach 1). A static array of beach configs, fetched in a loop every 5 minutes, cached in dictionaries keyed by slug. Keeps the single-file architecture.

## Beach Registry

| Slug | Beach Name | Beach Coords | Weather City | Weather Coords |
|------|-----------|-------------|-------------|----------------|
| `wrightsville` | Wrightsville Beach | 34.2097, -77.7956 | Wilmington | 34.2257, -77.9447 |
| `carolina` | Carolina Beach | 34.0353, -77.8936 | Carolina Beach | 34.0353, -77.8864 |
| `kure` | Kure Beach | 33.9968, -77.9072 | Kure Beach | 33.9968, -77.9072 |
| `surf-city` | Surf City | 34.4271, -77.5461 | Surf City | 34.4235, -77.5393 |

## API Endpoints

| Endpoint | Returns | Purpose |
|----------|---------|---------|
| `GET /api/beaches` | `[{ slug, name, qualityScore, surfRating, waveHeightFt, ratingColor }]` | Summary bar data |
| `GET /api/beach/{slug}` | Full `BeachData` | Detailed surf data for selected beach |
| `GET /api/weather/{slug}` | Full `WeatherData` | Weather for selected beach's nearest town |

Old `/api/weather` and `/api/beach` endpoints are removed.

**Rating color logic** for summary bar:
- Green: qualityScore >= 55
- Yellow: qualityScore >= 25
- Red: qualityScore < 25

## Backend Changes

- Add `BeachConfig` record with slug, name, coordinates, weather city
- Static `BeachConfig[]` array with all 4 beaches
- Change cache from single variables to `Dictionary<string, WeatherData>` and `Dictionary<string, BeachData>`
- Fetch loop iterates all beaches on startup and every 5 minutes
- Rename `WilmingtonWeatherData` to `WeatherData`, `WrightsvilleBeachData` to `BeachData`

## Frontend Changes

**Summary bar** (below toolbar, always visible):
- Horizontal row of 4 beach chips: name, colored dot (red/yellow/green), wave height, quality label
- Clicking a chip switches the full dashboard to that beach
- Star icon to set "home spot" — saved in localStorage
- Home spot auto-selected on page load (defaults to Wrightsville)

**Dashboard updates on beach switch:**
- Header shows selected beach name and weather city
- Weather hero card shows that beach's nearest-town weather
- All surf components update: hero card, gauge, timeline, daily forecast, advisor
- Fetch calls use `/api/weather/{slug}` and `/api/beach/{slug}`

## What Stays the Same

- Single-page app, no new routes
- All existing UI components (gauge, timeline, forecast grid, surf cards, advisor, prefs panel, game modal)
- Preferences system (skill level, wave range, cold tolerance)
- All CSS inline in index.html
- No database — localStorage for home spot, in-memory cache for data
- No changes to game.html or telemetry
- 5-minute refresh interval
