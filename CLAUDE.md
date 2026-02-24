# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

```bash
dotnet build                    # Build the project
dotnet run                      # Run the app (http://localhost:5103)
dotnet run --launch-profile http # Explicitly use the http profile
```

Tests: `dotnet test DotNetWebApp.Tests/` (see CI Harness section below)

## CI Harness

A pre-push quality gate harness runs before every `git push`:

```bash
./scripts/ci-harness.sh          # Run manually
./scripts/install-hooks.sh       # Install as git pre-push hook (one-time)
git push --no-verify             # Bypass the harness
dotnet test DotNetWebApp.Tests/ --filter "Category!=Integration"  # Run mocked tests only
dotnet test DotNetWebApp.Tests/ --filter "Category=Integration"   # Run real API tests
```

### Quality Gates
1. **Build** — `dotnet build --no-incremental -warnaserror`
2. **Format** — `dotnet format --verify-no-changes`
3. **Test** — xUnit tests with mocked HttpClient (excludes integration tests)
4. **Code Review** — Claude CLI reviews git diff for bugs, security, conventions

### Before Pushing
Always use `git push` (never `--no-verify`). The pre-push hook runs the CI harness automatically. If the push is blocked, read `.claude/harness-results.json`, fix all reported issues, commit the fixes, and retry `git push`. Repeat until all gates pass.

## Project Structure

```
Program.cs                  # Entire backend (API, caching, telemetry, models)
wwwroot/
  index.html                # SPA dashboard (inline HTML/CSS/JS)
  game.html                 # Canvas-based "Surf Flyer" mini-game
telemetry/                  # Runtime JSONL logs/metrics (gitignored)
Properties/
  launchSettings.json       # Dev server profile (port 5103)
DotNetWebApp.Tests/         # xUnit test project
  ApiTests.cs               # Mocked API endpoint tests
  IntegrationTests.cs       # Real API integration tests (tagged)
  CustomWebAppFactory.cs    # WebApplicationFactory with mocked HttpClient
  Fixtures/                 # Canned Open-Meteo JSON responses
scripts/
  ci-harness.sh             # CI/CD quality gate harness
  install-hooks.sh          # Git hook installer
```

## Architecture

ASP.NET Core (.NET 10) minimal API serving a weather and surf conditions dashboard for multiple NC beaches.

### Backend (Program.cs)

- **Single-file architecture** — all backend code lives in `Program.cs`: endpoints, data fetching, caching, telemetry, helper functions, and record types.
- **Beach registry** — a `BeachConfig` array defines each supported beach (slug, name, lat/lon for marine + weather). Currently 4 NC beaches: Wrightsville, Carolina, Kure, Surf City.
- **Minimal API** with three JSON endpoints:
  - `GET /api/beaches` — summary list of all beaches with quality score, rating, wave height, and color indicator
  - `GET /api/beach/{slug}` — full surf/marine data for one beach (current + hourly timeline + 3-day forecast)
  - `GET /api/weather/{slug}` — weather data for one beach (current + 5-day forecast)
- **Data source**: Open-Meteo public APIs (weather + marine). No API key required.
- **Caching**: In-memory `Dictionary<string, T>` keyed by beach slug (no database). Data for all beaches is fetched on startup and refreshed every 5 minutes via `Timer`.
- **Telemetry**: OpenTelemetry tracing + custom metrics, plus file-based exporters writing JSONL to `telemetry/logs.jsonl` and `telemetry/metrics.jsonl`. Custom `FileLoggerProvider`, `FileLogger`, and `FileMetricExporter` classes at the bottom of Program.cs.
- **Record types**: `BeachConfig` for beach definitions, API deserialization models (`OpenMeteo*` records), and app response models (`WeatherData`, `BeachData`, `BeachSummary`, etc.) at the bottom of Program.cs.
- **Helper functions**: WMO weather codes, wind direction, and surf quality scoring defined as local functions.

### Frontend (wwwroot/)

- `index.html` — Single-page dashboard with all HTML, CSS, and JS inline. Features a **beach summary bar** showing all beaches as chips with red/yellow/green quality indicators. Clicking a chip switches the dashboard to that beach (via slug-based routing). A **star icon** lets users set a "home spot" (saved in localStorage) which loads by default. The header dynamically shows the selected beach name. Fetches `/api/beaches`, `/api/weather/{slug}`, and `/api/beach/{slug}` to render current conditions, surf quality gauge, hourly surf timeline, 5-day forecast, and daily surf forecast. User preferences (skill level, wave range, cold tolerance) also stored in localStorage.
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

## Memory Protocol

This project uses a file-based memory system at `~/.claude/projects/-Users-parker-VSCode-dotNetWebApp/memory/`. It keeps context fresh across agents and sessions.

### For the Orchestrator (Main Agent)

**Session start:**
1. `memory/MEMORY.md` is auto-loaded — review it
2. Read `memory/session-log.md` to check for unfinished work
3. Read relevant topic files (`codebase.md`, `preferences.md`) if the task needs them

**During work:**
- When dispatching subagents, include: "Read `memory/codebase.md` before starting. Return any new learnings in a `## Learnings` section at the end of your response."
- When a subagent returns learnings, evaluate and persist worthy ones to the appropriate topic file

**Session end:**
1. Write a handoff entry to `memory/session-log.md` (keep max 5 entries, remove oldest)
2. Update `memory/MEMORY.md` if new important facts were learned
3. Update topic files if relevant

### For Subagents

- Read memory files at start of task (when told to by orchestrator)
- Never write to memory files directly
- Return learnings in a `## Learnings` section at the end of your response

### Memory Hygiene

- `MEMORY.md` must stay under 200 lines
- Don't duplicate CLAUDE.md content in memory files
- Delete facts immediately when discovered to be wrong
- Confidence: `high` = verified multiple times, `medium` = observed once, `low` = inferred
