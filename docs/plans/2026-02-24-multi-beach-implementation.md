# Multi-Beach Support Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expand the dashboard from one hardcoded beach to 4 NC beaches with a summary bar, beach switching, and home spot feature.

**Architecture:** Static beach registry in Program.cs. Data cached in dictionaries keyed by slug. Frontend summary bar with colored indicators, star-to-favorite, and full dashboard switching.

**Tech Stack:** ASP.NET Core (.NET 10) minimal API, vanilla HTML/CSS/JS (inline in index.html), Open-Meteo APIs.

**Design doc:** `docs/plans/2026-02-24-multi-beach-design.md`

---

### Task 1: Add BeachConfig record and beach registry

**Files:**
- Modify: `Program.cs:324-340` (record types section at bottom of file)
- Modify: `Program.cs:76-79` (cached data variables)

**Step 1: Add BeachConfig record at the bottom of Program.cs (after existing records, before telemetry exporters)**

Add this right before the `// --- File-based telemetry exporters ---` comment (line 342):

```csharp
record BeachConfig(string Slug, string Name, double BeachLat, double BeachLon,
    string WeatherCity, double WeatherLat, double WeatherLon);
```

**Step 2: Add the static beach registry near the top of Program.cs**

Add after `var jsonOptions = ...` (line 76), replacing the cached data variables:

```csharp
var beaches = new BeachConfig[]
{
    new("wrightsville", "Wrightsville Beach", 34.2097, -77.7956, "Wilmington", 34.2257, -77.9447),
    new("carolina", "Carolina Beach", 34.0353, -77.8936, "Carolina Beach", 34.0353, -77.8864),
    new("kure", "Kure Beach", 33.9968, -77.9072, "Kure Beach", 33.9968, -77.9072),
    new("surf-city", "Surf City", 34.4271, -77.5461, "Surf City", 34.4235, -77.5393),
};
```

**Step 3: Replace single cached variables with dictionaries**

Replace these lines (currently lines 77-79):
```csharp
WilmingtonWeatherData? cachedWeather = null;
WrightsvilleBeachData? cachedBeach = null;
var lastFetchedAt = DateTime.MinValue;
```

With:
```csharp
var cachedWeather = new Dictionary<string, WeatherData>();
var cachedBeach = new Dictionary<string, BeachData>();
var lastFetchedAt = DateTime.MinValue;
```

**Step 4: Rename the record types**

Rename `WilmingtonWeatherData` to `WeatherData` (find/replace all occurrences):
```csharp
record WeatherData(
    double CurrentTempF, string Condition, string ConditionIcon,
    double WindMph, int HumidityPct, List<DailyForecast> Daily);
```

Rename `WrightsvilleBeachData` to `BeachData`:
```csharp
record BeachData(
    double SeaTempF, double WaveHeightFt, double WavePeriodS,
    string SwellDirection, string SurfRating, int QualityScore,
    List<HourlySurf> Hourly, List<DailySurf> Daily);
```

**Step 5: Build and verify it compiles**

Run: `dotnet build`
Expected: Build errors because `FetchWeatherDataAsync` and endpoints still reference old variable types. That's expected — we fix those in Task 2.

**Step 6: Commit**

```bash
git add Program.cs
git commit -m "feat: add BeachConfig registry and rename models for multi-beach"
```

---

### Task 2: Refactor FetchWeatherDataAsync to loop over all beaches

**Files:**
- Modify: `Program.cs:132-257` (FetchWeatherDataAsync function and its callers)

**Step 1: Rewrite FetchWeatherDataAsync to accept a BeachConfig parameter**

Replace the entire `FetchWeatherDataAsync` function with one that takes a `BeachConfig` and uses its coordinates:

```csharp
async Task FetchBeachDataAsync(BeachConfig beach)
{
    using var activity = activitySource.StartActivity($"FetchBeachData:{beach.Slug}");
    var client = httpClientFactory.CreateClient();

    try
    {
        // Fetch weather for this beach's nearest town
        var weatherUrl = "https://api.open-meteo.com/v1/forecast"
            + $"?latitude={beach.WeatherLat}&longitude={beach.WeatherLon}"
            + "&daily=temperature_2m_max,temperature_2m_min,weather_code"
            + "&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m"
            + "&temperature_unit=fahrenheit&wind_speed_unit=mph"
            + "&timezone=America/New_York&forecast_days=5";

        var weatherJson = await client.GetStringAsync(weatherUrl);
        var weatherRaw = JsonSerializer.Deserialize<OpenMeteoWeatherResponse>(weatherJson, jsonOptions)!;

        var desc = WmoToDescription(weatherRaw.Current.WeatherCode);
        var dailyForecasts = new List<DailyForecast>();
        for (int i = 0; i < weatherRaw.Daily.Time.Count; i++)
        {
            var dDesc = WmoToDescription(weatherRaw.Daily.WeatherCode[i]);
            dailyForecasts.Add(new DailyForecast(
                weatherRaw.Daily.Time[i],
                Math.Round(weatherRaw.Daily.TemperatureMax[i], 1),
                Math.Round(weatherRaw.Daily.TemperatureMin[i], 1),
                dDesc[0],
                dDesc[1]));
        }

        cachedWeather[beach.Slug] = new WeatherData(
            Math.Round(weatherRaw.Current.Temperature, 1),
            desc[0],
            desc[1],
            Math.Round(weatherRaw.Current.WindSpeed, 1),
            weatherRaw.Current.Humidity,
            dailyForecasts);

        logger.LogInformation(
            "{BeachName} weather fetched: {CurrentTemp}F, {Condition}",
            beach.WeatherCity, cachedWeather[beach.Slug].CurrentTempF, cachedWeather[beach.Slug].Condition);

        // Fetch marine data for this beach
        var marineUrl = "https://marine-api.open-meteo.com/v1/marine"
            + $"?latitude={beach.BeachLat}&longitude={beach.BeachLon}"
            + "&current=wave_height,wave_period,wave_direction"
            + "&daily=wave_height_max,wave_period_max,wave_direction_dominant"
            + "&hourly=wave_height,wave_period,wave_direction,sea_surface_temperature"
            + "&temperature_unit=fahrenheit"
            + "&timezone=America/New_York&forecast_days=3";

        var marineJson = await client.GetStringAsync(marineUrl);
        var marineRaw = JsonSerializer.Deserialize<OpenMeteoMarineResponse>(marineJson, jsonOptions)!;

        var seaTempF = marineRaw.Hourly.SeaSurfaceTemperature
            .Where(t => t.HasValue).LastOrDefault() ?? 0;

        var waveHt = Math.Round(marineRaw.Current.WaveHeight * 3.281, 1);
        var swellDir = DirectionFromDegrees(marineRaw.Current.WaveDirection);
        var currentQ = SurfQuality(marineRaw.Current.WaveHeight, marineRaw.Current.WavePeriod);

        var hourlySurf = new List<HourlySurf>();
        for (int i = 0; i < marineRaw.Hourly.Time.Count; i++)
        {
            var hWaveM = marineRaw.Hourly.WaveHeight[i] ?? 0;
            var hPeriod = marineRaw.Hourly.WavePeriod[i] ?? 0;
            var hDir = marineRaw.Hourly.WaveDirection[i] ?? 0;
            var hQ = SurfQuality(hWaveM, hPeriod);
            hourlySurf.Add(new HourlySurf(
                marineRaw.Hourly.Time[i],
                Math.Round(hWaveM * 3.281, 1),
                Math.Round(hPeriod, 1),
                DirectionFromDegrees(hDir),
                hQ.Label, hQ.Score));
        }

        var dailySurf = new List<DailySurf>();
        for (int i = 0; i < marineRaw.Daily.Time.Count; i++)
        {
            var dHt = Math.Round(marineRaw.Daily.WaveHeightMax[i] * 3.281, 1);
            var dDir = DirectionFromDegrees(marineRaw.Daily.WaveDirectionDominant[i]);
            var dQ = SurfQuality(marineRaw.Daily.WaveHeightMax[i], marineRaw.Daily.WavePeriodMax[i]);
            dailySurf.Add(new DailySurf(
                marineRaw.Daily.Time[i], dHt,
                Math.Round(marineRaw.Daily.WavePeriodMax[i], 1),
                dDir, dQ.Label, dQ.Score));
        }

        cachedBeach[beach.Slug] = new BeachData(
            Math.Round(seaTempF, 1),
            waveHt, Math.Round(marineRaw.Current.WavePeriod, 1),
            swellDir, currentQ.Label, currentQ.Score,
            hourlySurf, dailySurf);

        logger.LogInformation(
            "{BeachName} surf fetched: Sea {SeaTemp}F, Waves {WaveHeight}ft @ {WavePeriod}s, Rating: {SurfRating} ({QualityScore}/100)",
            beach.Name, cachedBeach[beach.Slug].SeaTempF, cachedBeach[beach.Slug].WaveHeightFt,
            cachedBeach[beach.Slug].WavePeriodS, cachedBeach[beach.Slug].SurfRating, cachedBeach[beach.Slug].QualityScore);

        weatherFetchCount.Add(1, new KeyValuePair<string, object?>("beach", beach.Slug));
    }
    catch (Exception ex)
    {
        weatherFetchErrors.Add(1, new KeyValuePair<string, object?>("beach", beach.Slug));
        activity?.SetTag("error", true);
        logger.LogError(ex, "Failed to fetch data for {BeachName}", beach.Name);
    }
}
```

**Step 2: Replace the fetch-all logic**

Replace the old initial fetch + timer (lines ~255-257):

```csharp
async Task FetchAllBeachesAsync()
{
    foreach (var beach in beaches)
    {
        await FetchBeachDataAsync(beach);
    }
    lastFetchedAt = DateTime.UtcNow;
}

await FetchAllBeachesAsync();
var weatherTimer = new Timer(async _ => await FetchAllBeachesAsync(),
    null, TimeSpan.FromMinutes(5), TimeSpan.FromMinutes(5));
```

**Step 3: Build and verify**

Run: `dotnet build`
Expected: Build errors on the endpoint handlers (still referencing old variables). Fixed in Task 3.

**Step 4: Commit**

```bash
git add Program.cs
git commit -m "feat: refactor data fetching to loop over all beaches"
```

---

### Task 3: Update API endpoints

**Files:**
- Modify: `Program.cs:264-279` (endpoint definitions)

**Step 1: Add BeachSummary record**

Add near the other app response records at the bottom of Program.cs:

```csharp
record BeachSummary(string Slug, string Name, int QualityScore, string SurfRating,
    double WaveHeightFt, string RatingColor);
```

**Step 2: Replace the two old endpoints with three new ones**

Replace the existing `MapGet` calls:

```csharp
app.MapGet("/api/beaches", () =>
{
    var summaries = beaches.Select(b =>
    {
        if (!cachedBeach.TryGetValue(b.Slug, out var data))
            return new BeachSummary(b.Slug, b.Name, 0, "Unknown", 0, "red");

        var color = data.QualityScore >= 55 ? "green" : data.QualityScore >= 25 ? "yellow" : "red";
        return new BeachSummary(b.Slug, b.Name, data.QualityScore, data.SurfRating,
            data.WaveHeightFt, color);
    }).ToList();
    return Results.Ok(summaries);
}).WithName("GetAllBeaches");

app.MapGet("/api/beach/{slug}", (string slug) =>
{
    forecastRequestCount.Add(1);
    if (cachedBeach.TryGetValue(slug, out var data))
    {
        var age = (DateTime.UtcNow - lastFetchedAt).TotalSeconds;
        forecastCacheAge.Record(age);
        return Results.Ok(data);
    }
    return Results.NotFound(new { error = $"Beach '{slug}' not found" });
}).WithName("GetBeachBySlug");

app.MapGet("/api/weather/{slug}", (string slug) =>
{
    forecastRequestCount.Add(1);
    if (cachedWeather.TryGetValue(slug, out var data))
    {
        var age = (DateTime.UtcNow - lastFetchedAt).TotalSeconds;
        forecastCacheAge.Record(age);
        return Results.Ok(data);
    }
    return Results.NotFound(new { error = $"Beach '{slug}' not found" });
}).WithName("GetWeatherBySlug");
```

**Step 3: Build and run**

Run: `dotnet build && dotnet run`
Expected: App starts, fetches data for all 4 beaches. Test manually:
- `curl http://localhost:5103/api/beaches` — should return array of 4 beach summaries
- `curl http://localhost:5103/api/beach/wrightsville` — should return full surf data
- `curl http://localhost:5103/api/weather/carolina` — should return Carolina Beach weather

**Step 4: Commit**

```bash
git add Program.cs
git commit -m "feat: add multi-beach API endpoints"
```

---

### Task 4: Add summary bar to frontend

**Files:**
- Modify: `wwwroot/index.html` (CSS + HTML + JS)

**Step 1: Add summary bar CSS**

Add these styles inside the existing `<style>` block, before the closing `</style>` tag:

```css
/* --- Beach Summary Bar --- */
.beach-bar {
    display: flex; gap: 8px; margin-bottom: 28px; flex-wrap: wrap;
}
.beach-chip {
    display: flex; align-items: center; gap: 8px;
    padding: 10px 16px; background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.08); border-radius: 12px;
    cursor: pointer; transition: all 0.2s; flex: 1; min-width: 140px;
}
.beach-chip:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.15); }
.beach-chip.active { border-color: rgba(59,130,246,0.5); background: rgba(59,130,246,0.1); }
.beach-chip .chip-dot {
    width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0;
}
.beach-chip .chip-dot.green { background: #22c55e; }
.beach-chip .chip-dot.yellow { background: #eab308; }
.beach-chip .chip-dot.red { background: #ef4444; }
.beach-chip .chip-info { flex: 1; min-width: 0; }
.beach-chip .chip-name { font-size: 0.8rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.beach-chip .chip-stats { font-size: 0.7rem; color: #64748b; }
.beach-chip .chip-star {
    font-size: 1.1rem; cursor: pointer; opacity: 0.3; transition: opacity 0.2s;
    background: none; border: none; padding: 0; line-height: 1;
}
.beach-chip .chip-star:hover { opacity: 0.7; }
.beach-chip .chip-star.starred { opacity: 1; }
```

**Step 2: Add the summary bar HTML**

Add this right after the prefs panel `</div>` and before the `<div id="content">` line:

```html
<div class="beach-bar" id="beachBar"></div>
```

**Step 3: Add summary bar JS**

Add these variables and functions in the `<script>` block, before the `loadAll()` function:

```javascript
// --- Beach selection ---
let currentSlug = null;
let allBeaches = [];

function getHomeSpot() {
    return localStorage.getItem('homeSpot') || 'wrightsville';
}

function setHomeSpot(slug) {
    localStorage.setItem('homeSpot', slug);
    renderBeachBar();
}

function selectBeach(slug) {
    currentSlug = slug;
    renderBeachBar();
    loadAll();
}

async function loadBeachBar() {
    try {
        const res = await fetch('/api/beaches');
        if (!res.ok) return;
        allBeaches = await res.json();
        if (!currentSlug) currentSlug = getHomeSpot();
        renderBeachBar();
    } catch (e) {
        console.error('Failed to load beach bar', e);
    }
}

function renderBeachBar() {
    const bar = document.getElementById('beachBar');
    const homeSpot = getHomeSpot();
    bar.innerHTML = allBeaches.map(b => {
        const isActive = b.slug === currentSlug;
        const isHome = b.slug === homeSpot;
        return `<div class="beach-chip ${isActive ? 'active' : ''}" onclick="selectBeach('${b.slug}')">
            <div class="chip-dot ${b.ratingColor}"></div>
            <div class="chip-info">
                <div class="chip-name">${b.name}</div>
                <div class="chip-stats">${b.waveHeightFt}ft · ${b.surfRating}</div>
            </div>
            <button class="chip-star ${isHome ? 'starred' : ''}"
                onclick="event.stopPropagation(); setHomeSpot('${b.slug}')"
                title="${isHome ? 'Home spot' : 'Set as home spot'}">
                ${isHome ? '\u2605' : '\u2606'}
            </button>
        </div>`;
    }).join('');
}
```

**Step 4: Update `loadAll()` to use the selected beach slug**

Change the fetch calls inside `loadAll()` from:
```javascript
const [weatherRes, beachRes] = await Promise.all([
    fetch('/api/weather'), fetch('/api/beach')
]);
```

To:
```javascript
if (!currentSlug) currentSlug = getHomeSpot();
const [weatherRes, beachRes] = await Promise.all([
    fetch(`/api/weather/${currentSlug}`), fetch(`/api/beach/${currentSlug}`)
]);
```

**Step 5: Update the header to show the selected beach**

Change the header HTML from:
```html
<h1>Weather & Surf</h1>
<div class="location">Wilmington, NC &middot; Wrightsville Beach</div>
```

To:
```html
<h1>CheckMySurf</h1>
<div class="location" id="headerLocation">Loading...</div>
```

**Step 6: Update `loadAll()` to set the header dynamically**

Add this inside `loadAll()` after the data is fetched, before building the HTML:

```javascript
const beachInfo = allBeaches.find(b => b.slug === currentSlug);
const beachName = beachInfo ? beachInfo.name : currentSlug;
document.getElementById('headerLocation').textContent = beachName;
```

**Step 7: Update the hero card titles to be dynamic**

In the hero cards HTML section of `loadAll()`, change:
- `Wilmington, NC &mdash; Now` → use the beach's weather city name
- `Wrightsville Beach &mdash; Surf` → use the selected beach name

The weather city can be derived from a mapping or included in the beaches API. For simplicity, add a `weatherCity` field to the `/api/beaches` response.

In Program.cs, update the `BeachSummary` record:
```csharp
record BeachSummary(string Slug, string Name, string WeatherCity, int QualityScore,
    string SurfRating, double WaveHeightFt, string RatingColor);
```

And update the mapping in the `/api/beaches` endpoint to include `b.WeatherCity`.

Then in the frontend hero cards:
```javascript
html += `<div class="hero-card">
    <h2>${beachInfo?.weatherCity || beachName} &mdash; Now</h2>
    ...
`;
```

And:
```javascript
html += `<div class="hero-card">
    <h2>${beachName} &mdash; Surf</h2>
    ...
`;
```

**Step 8: Update page initialization**

Change the bottom of the script from:
```javascript
restorePrefs();
loadAll();
```

To:
```javascript
restorePrefs();
loadBeachBar().then(() => loadAll());
```

**Step 9: Build and test in browser**

Run: `dotnet run`
Open: `http://localhost:5103`
Expected:
- Summary bar shows 4 beach chips with colored dots
- Clicking a chip switches the entire dashboard
- Star icon toggles home spot (persists on refresh)
- Header updates to show selected beach name

**Step 10: Commit**

```bash
git add Program.cs wwwroot/index.html
git commit -m "feat: add beach summary bar with switching and home spot"
```

---

### Task 5: Update the refresh button and beach bar sync

**Files:**
- Modify: `wwwroot/index.html`

**Step 1: Update the refresh button to also reload the beach bar**

Change the `loadAll` function's finally block or add a wrapper. Update the refresh button onclick and the auto-refresh to also call `loadBeachBar()`:

In `loadAll()`, add at the top of the try block (after the fetch calls succeed):
```javascript
// Refresh beach bar summary data too
loadBeachBar();
```

This ensures the summary bar's colored dots and stats update when the user clicks Refresh.

**Step 2: Build and verify**

Run: `dotnet run`
Expected: Clicking Refresh updates both the beach bar indicators and the main dashboard.

**Step 3: Commit**

```bash
git add wwwroot/index.html
git commit -m "feat: sync beach bar on refresh"
```

---

### Task 6: Update CLAUDE.md with new architecture

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Update the CLAUDE.md to reflect multi-beach support**

Update the Backend section to document:
- Beach registry pattern (4 beaches, `BeachConfig` record)
- New endpoints: `/api/beaches`, `/api/beach/{slug}`, `/api/weather/{slug}`
- Dictionary-based caching keyed by slug
- Renamed models: `WeatherData`, `BeachData`

Update the Frontend section to document:
- Summary bar with red/yellow/green indicators
- Home spot feature (localStorage)
- Beach switching via slug

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for multi-beach architecture"
```

---

### Task 7: Final integration test and push

**Step 1: Run the app**

Run: `dotnet run`

**Step 2: Manual verification checklist**

- [ ] `curl http://localhost:5103/api/beaches` returns 4 beaches with colors
- [ ] `curl http://localhost:5103/api/beach/carolina` returns surf data
- [ ] `curl http://localhost:5103/api/weather/kure` returns weather data
- [ ] `curl http://localhost:5103/api/beach/nonexistent` returns 404
- [ ] Dashboard loads with home spot beach selected
- [ ] Clicking each beach chip switches all data
- [ ] Starring a beach persists after refresh
- [ ] Colored dots match quality scores (red < 25, yellow 25-54, green >= 55)
- [ ] Preferences still work (skill level, wave range, cold tolerance)
- [ ] Surf game still opens and works

**Step 3: Push to GitHub**

```bash
git push origin main
```
