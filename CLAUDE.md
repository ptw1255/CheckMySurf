# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

```bash
dotnet build                    # Build the project
dotnet run                      # Run the app (http://localhost:5103)
dotnet run --launch-profile http # Explicitly use the http profile
```

No tests exist in this project yet.

## Project Structure

```
Program.cs                  # Entire backend (API, caching, telemetry, models)
wwwroot/
  index.html                # SPA dashboard (inline HTML/CSS/JS)
  game.html                 # Canvas-based "Surf Flyer" mini-game
telemetry/                  # Runtime JSONL logs/metrics (gitignored)
Properties/
  launchSettings.json       # Dev server profile (port 5103)
```

## Architecture

ASP.NET Core (.NET 10) minimal API serving a weather and surf conditions dashboard for Wilmington, NC and Wrightsville Beach.

### Backend (Program.cs)

- **Single-file architecture** — all backend code lives in `Program.cs`: endpoints, data fetching, caching, telemetry, helper functions, and record types.
- **Minimal API** with two JSON endpoints:
  - `GET /api/weather` — Wilmington weather (current + 5-day forecast)
  - `GET /api/beach` — Wrightsville Beach surf/marine data (current + hourly timeline + 3-day forecast)
- **Data source**: Open-Meteo public APIs (weather + marine). No API key required.
- **Caching**: In-memory only (no database). Data is fetched on startup and refreshed every 5 minutes via `Timer`.
- **Telemetry**: OpenTelemetry tracing + custom metrics, plus file-based exporters writing JSONL to `telemetry/logs.jsonl` and `telemetry/metrics.jsonl`. Custom `FileLoggerProvider`, `FileLogger`, and `FileMetricExporter` classes at the bottom of Program.cs.
- **Record types**: API deserialization models (`OpenMeteo*` records) and app response models (`WilmingtonWeatherData`, `WrightsvilleBeachData`, etc.) at the bottom of Program.cs.
- **Helper functions**: WMO weather codes, wind direction, and surf quality scoring defined as local functions.

### Frontend (wwwroot/)

- `index.html` — Single-page dashboard with all HTML, CSS, and JS inline. Fetches `/api/weather` and `/api/beach`, renders current conditions, surf quality gauge, hourly surf timeline, 5-day forecast, and daily surf forecast. User preferences (skill level, wave range, cold tolerance) stored in localStorage.
- `game.html` — Canvas-based "Surf Flyer" mini-game, loaded in an iframe modal from the dashboard.
- Static files served via `UseStaticFiles()` with `UseDefaultFiles()` (so `/` serves `index.html`).

## Key Patterns & Conventions

- **Single-file backend**: Keep all backend code in `Program.cs`. Don't split into controllers/services unless explicitly requested.
- **Inline frontend**: HTML, CSS, and JS are all inline within each `.html` file. No build tools, bundlers, or separate asset files.
- **Imperial units**: All API responses use Fahrenheit, mph, and feet. Metric-to-imperial conversion happens server-side.
- **Wave height conversion**: Open-Meteo returns meters; multiply by 3.281 to convert to feet before caching.
- **Surf quality scoring**: 0–100 based on wave height and period, with labels from "Flat" to "Epic".
- **No database**: All state is in-memory. Restarting the app re-fetches from Open-Meteo.
- **No authentication**: All endpoints are public.

## Dependencies

- **OpenTelemetry** (tracing, metrics, ASP.NET Core + HTTP instrumentation) — v1.15.0
- **Microsoft.AspNetCore.OpenApi** — v10.0.3
- **Target framework**: .NET 10
