using System.Diagnostics;
using System.Diagnostics.Metrics;
using System.Text.Json;
using System.Text.Json.Serialization;
using OpenTelemetry;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

var builder = WebApplication.CreateBuilder(args);

var serviceName = "DotNetWebApp";

// Telemetry output files
var telemetryDir = Path.Combine(builder.Environment.ContentRootPath, "telemetry");
Directory.CreateDirectory(telemetryDir);
var logsPath = Path.Combine(telemetryDir, "logs.jsonl");
var metricsPath = Path.Combine(telemetryDir, "metrics.jsonl");

// Configure OpenTelemetry
builder.Services.AddOpenTelemetry()
    .ConfigureResource(resource => resource.AddService(serviceName))
    .WithTracing(tracing => tracing
        .AddAspNetCoreInstrumentation()
        .AddHttpClientInstrumentation()
        .AddSource(serviceName))
    .WithMetrics(metrics => metrics
        .AddAspNetCoreInstrumentation()
        .AddHttpClientInstrumentation()
        .AddMeter(serviceName)
        .AddReader(new PeriodicExportingMetricReader(
            new FileMetricExporter(metricsPath),
            exportIntervalMilliseconds: 5000)));

// Structured logging: console + file
builder.Logging.AddSimpleConsole(options =>
{
    options.IncludeScopes = true;
    options.TimestampFormat = "yyyy-MM-dd HH:mm:ss ";
});
builder.Logging.AddProvider(new FileLoggerProvider(logsPath));

builder.Services.AddHttpClient();
builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

var logger = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger(serviceName);
var httpClientFactory = app.Services.GetRequiredService<IHttpClientFactory>();

// ActivitySource for custom spans
var activitySource = new ActivitySource(serviceName);

// Custom metrics
var meter = new Meter(serviceName);
var weatherFetchCount = meter.CreateCounter<long>(
    "weather.fetch.count",
    description: "Number of times weather data has been fetched from API");
var weatherFetchErrors = meter.CreateCounter<long>(
    "weather.fetch.errors",
    description: "Number of failed weather API fetches");
var forecastRequestCount = meter.CreateCounter<long>(
    "forecast.request.count",
    description: "Number of forecast API requests served");
var forecastCacheAge = meter.CreateHistogram<double>(
    "forecast.cache.age",
    unit: "s",
    description: "Age of the cached forecast when served");

// --- Cached weather data ---
var jsonOptions = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
WilmingtonWeatherData? cachedWeather = null;
WrightsvilleBeachData? cachedBeach = null;
var lastFetchedAt = DateTime.MinValue;

// WMO weather code to description + icon mapping
string[] WmoToDescription(int code) => code switch
{
    0 => ["Clear Sky", "clear"],
    1 => ["Mainly Clear", "clear"],
    2 => ["Partly Cloudy", "partly-cloudy"],
    3 => ["Overcast", "overcast"],
    45 or 48 => ["Foggy", "fog"],
    51 or 53 or 55 => ["Drizzle", "drizzle"],
    61 or 63 or 65 => ["Rain", "rain"],
    66 or 67 => ["Freezing Rain", "freezing-rain"],
    71 or 73 or 75 => ["Snow", "snow"],
    77 => ["Snow Grains", "snow"],
    80 or 81 or 82 => ["Rain Showers", "rain"],
    85 or 86 => ["Snow Showers", "snow"],
    95 => ["Thunderstorm", "thunderstorm"],
    96 or 99 => ["Thunderstorm w/ Hail", "thunderstorm"],
    _ => ["Unknown", "unknown"]
};

string DirectionFromDegrees(double degrees)
{
    string[] dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
                     "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
    return dirs[(int)Math.Round(degrees / 22.5) % 16];
}

// Returns (label, score 0-100)
(string Label, int Score) SurfQuality(double waveHeightM, double wavePeriodS)
{
    // Height score: 0m=0, 0.3m=15, 0.6m=35, 1.0m=55, 1.5m=75, 2.0m=90, 2.5+=100
    double hs = Math.Min(waveHeightM / 2.5, 1.0) * 70;
    // Period bonus: longer period = cleaner waves
    double ps = Math.Min(wavePeriodS / 14.0, 1.0) * 30;
    int score = (int)Math.Round(hs + ps);
    score = Math.Clamp(score, 0, 100);

    string label = score switch
    {
        < 10 => "Flat",
        < 25 => "Poor",
        < 40 => "Poor to Fair",
        < 55 => "Fair",
        < 70 => "Fair to Good",
        < 85 => "Good",
        < 95 => "Good to Epic",
        _ => "Epic"
    };
    return (label, score);
}

async Task FetchWeatherDataAsync()
{
    using var activity = activitySource.StartActivity("FetchWeatherData");
    var client = httpClientFactory.CreateClient();

    try
    {
        // Fetch Wilmington weather
        var weatherUrl = "https://api.open-meteo.com/v1/forecast"
            + "?latitude=34.2257&longitude=-77.9447"
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

        cachedWeather = new WilmingtonWeatherData(
            Math.Round(weatherRaw.Current.Temperature, 1),
            desc[0],
            desc[1],
            Math.Round(weatherRaw.Current.WindSpeed, 1),
            weatherRaw.Current.Humidity,
            dailyForecasts);

        activity?.SetTag("weather.current_temp", cachedWeather.CurrentTempF);
        activity?.SetTag("weather.condition", cachedWeather.Condition);

        logger.LogInformation(
            "Wilmington weather fetched: {CurrentTemp}F, {Condition}, Wind {WindSpeed}mph, Humidity {Humidity}%",
            cachedWeather.CurrentTempF, cachedWeather.Condition,
            cachedWeather.WindMph, cachedWeather.HumidityPct);

        // Fetch Wrightsville Beach marine data (including hourly for timeline)
        var marineUrl = "https://marine-api.open-meteo.com/v1/marine"
            + "?latitude=34.2097&longitude=-77.7956"
            + "&current=wave_height,wave_period,wave_direction"
            + "&daily=wave_height_max,wave_period_max,wave_direction_dominant"
            + "&hourly=wave_height,wave_period,wave_direction,sea_surface_temperature"
            + "&temperature_unit=fahrenheit"
            + "&timezone=America/New_York&forecast_days=3";

        var marineJson = await client.GetStringAsync(marineUrl);
        var marineRaw = JsonSerializer.Deserialize<OpenMeteoMarineResponse>(marineJson, jsonOptions)!;

        // Get the most recent non-null sea surface temp
        var seaTempF = marineRaw.Hourly.SeaSurfaceTemperature
            .Where(t => t.HasValue).LastOrDefault() ?? 0;

        var waveHt = Math.Round(marineRaw.Current.WaveHeight * 3.281, 1); // m to ft
        var swellDir = DirectionFromDegrees(marineRaw.Current.WaveDirection);
        var currentQ = SurfQuality(marineRaw.Current.WaveHeight, marineRaw.Current.WavePeriod);

        // Build hourly surf timeline
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

        cachedBeach = new WrightsvilleBeachData(
            Math.Round(seaTempF, 1),
            waveHt, Math.Round(marineRaw.Current.WavePeriod, 1),
            swellDir, currentQ.Label, currentQ.Score,
            hourlySurf, dailySurf);

        activity?.SetTag("beach.sea_temp_f", cachedBeach.SeaTempF);
        activity?.SetTag("beach.wave_height_ft", cachedBeach.WaveHeightFt);
        activity?.SetTag("beach.surf_rating", cachedBeach.SurfRating);
        activity?.SetTag("beach.quality_score", cachedBeach.QualityScore);

        logger.LogInformation(
            "Wrightsville Beach fetched: Sea {SeaTemp}F, Waves {WaveHeight}ft @ {WavePeriod}s from {SwellDir}, Rating: {SurfRating} ({QualityScore}/100)",
            cachedBeach.SeaTempF, cachedBeach.WaveHeightFt,
            cachedBeach.WavePeriodS, cachedBeach.SwellDirection, cachedBeach.SurfRating, cachedBeach.QualityScore);

        lastFetchedAt = DateTime.UtcNow;
        weatherFetchCount.Add(1);
    }
    catch (Exception ex)
    {
        weatherFetchErrors.Add(1);
        activity?.SetTag("error", true);
        logger.LogError(ex, "Failed to fetch weather data");
    }
}

// Initial fetch + periodic refresh every 5 minutes
await FetchWeatherDataAsync();
var weatherTimer = new Timer(async _ => await FetchWeatherDataAsync(),
    null, TimeSpan.FromMinutes(5), TimeSpan.FromMinutes(5));

logger.LogInformation("Application started. Weather data refreshes every {IntervalMinutes} minutes", 5);

app.UseDefaultFiles();
app.UseStaticFiles();

app.MapGet("/api/weather", () =>
{
    forecastRequestCount.Add(1);
    if (cachedWeather is not null)
    {
        var age = (DateTime.UtcNow - lastFetchedAt).TotalSeconds;
        forecastCacheAge.Record(age);
    }
    return cachedWeather;
}).WithName("GetWilmingtonWeather");

app.MapGet("/api/beach", () =>
{
    return cachedBeach;
}).WithName("GetWrightsvilleBeach");

app.Run();

// --- API response models (Open-Meteo) ---

record OpenMeteoWeatherResponse(
    [property: JsonPropertyName("current")] OpenMeteoCurrent Current,
    [property: JsonPropertyName("daily")] OpenMeteoDaily Daily);

record OpenMeteoCurrent(
    [property: JsonPropertyName("temperature_2m")] double Temperature,
    [property: JsonPropertyName("weather_code")] int WeatherCode,
    [property: JsonPropertyName("wind_speed_10m")] double WindSpeed,
    [property: JsonPropertyName("relative_humidity_2m")] int Humidity);

record OpenMeteoDaily(
    [property: JsonPropertyName("time")] List<string> Time,
    [property: JsonPropertyName("temperature_2m_max")] List<double> TemperatureMax,
    [property: JsonPropertyName("temperature_2m_min")] List<double> TemperatureMin,
    [property: JsonPropertyName("weather_code")] List<int> WeatherCode);

record OpenMeteoMarineResponse(
    [property: JsonPropertyName("current")] OpenMeteoMarineCurrent Current,
    [property: JsonPropertyName("daily")] OpenMeteoMarineDaily Daily,
    [property: JsonPropertyName("hourly")] OpenMeteoMarineHourly Hourly);

record OpenMeteoMarineCurrent(
    [property: JsonPropertyName("wave_height")] double WaveHeight,
    [property: JsonPropertyName("wave_period")] double WavePeriod,
    [property: JsonPropertyName("wave_direction")] double WaveDirection);

record OpenMeteoMarineDaily(
    [property: JsonPropertyName("time")] List<string> Time,
    [property: JsonPropertyName("wave_height_max")] List<double> WaveHeightMax,
    [property: JsonPropertyName("wave_period_max")] List<double> WavePeriodMax,
    [property: JsonPropertyName("wave_direction_dominant")] List<double> WaveDirectionDominant);

record OpenMeteoMarineHourly(
    [property: JsonPropertyName("time")] List<string> Time,
    [property: JsonPropertyName("wave_height")] List<double?> WaveHeight,
    [property: JsonPropertyName("wave_period")] List<double?> WavePeriod,
    [property: JsonPropertyName("wave_direction")] List<double?> WaveDirection,
    [property: JsonPropertyName("sea_surface_temperature")] List<double?> SeaSurfaceTemperature);

// --- App response models ---

record WilmingtonWeatherData(
    double CurrentTempF, string Condition, string ConditionIcon,
    double WindMph, int HumidityPct, List<DailyForecast> Daily);

record DailyForecast(string Date, double HighF, double LowF, string Condition, string ConditionIcon);

record WrightsvilleBeachData(
    double SeaTempF, double WaveHeightFt, double WavePeriodS,
    string SwellDirection, string SurfRating, int QualityScore,
    List<HourlySurf> Hourly, List<DailySurf> Daily);

record HourlySurf(string Time, double WaveHeightFt, double WavePeriodS,
    string SwellDirection, string SurfRating, int QualityScore);

record DailySurf(string Date, double WaveHeightFt, double WavePeriodS,
    string SwellDirection, string SurfRating, int QualityScore);

// --- File-based telemetry exporters ---

public class FileLoggerProvider : ILoggerProvider
{
    private readonly StreamWriter _writer;

    public FileLoggerProvider(string path)
    {
        _writer = new StreamWriter(path, append: true) { AutoFlush = true };
    }

    public ILogger CreateLogger(string categoryName) => new FileLogger(categoryName, _writer);
    public void Dispose() => _writer.Dispose();
}

public class FileLogger : ILogger
{
    private readonly string _category;
    private readonly StreamWriter _writer;

    public FileLogger(string category, StreamWriter writer)
    {
        _category = category;
        _writer = writer;
    }

    public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
    public bool IsEnabled(LogLevel logLevel) => logLevel >= LogLevel.Information;

    public void Log<TState>(LogLevel logLevel, EventId eventId, TState state,
        Exception? exception, Func<TState, Exception?, string> formatter)
    {
        if (!IsEnabled(logLevel)) return;

        var entry = JsonSerializer.Serialize(new
        {
            timestamp = DateTime.UtcNow.ToString("o"),
            level = logLevel.ToString(),
            category = _category,
            message = formatter(state, exception),
            exception = exception?.ToString()
        });

        lock (_writer) { _writer.WriteLine(entry); }
    }
}

public class FileMetricExporter : BaseExporter<Metric>
{
    private readonly StreamWriter _writer;

    public FileMetricExporter(string path)
    {
        _writer = new StreamWriter(path, append: true) { AutoFlush = true };
    }

    public override ExportResult Export(in Batch<Metric> batch)
    {
        var timestamp = DateTime.UtcNow.ToString("o");

        foreach (var metric in batch)
        {
            foreach (ref readonly var point in metric.GetMetricPoints())
            {
                var tags = new Dictionary<string, object?>();
                foreach (var tag in point.Tags)
                    tags[tag.Key] = tag.Value;

                var entry = new Dictionary<string, object?>
                {
                    ["timestamp"] = timestamp,
                    ["name"] = metric.Name,
                    ["unit"] = metric.Unit,
                    ["description"] = metric.Description,
                    ["type"] = metric.MetricType.ToString(),
                    ["tags"] = tags.Count > 0 ? tags : null
                };

                switch (metric.MetricType)
                {
                    case MetricType.LongSum:
                        entry["value"] = point.GetSumLong();
                        break;
                    case MetricType.DoubleSum:
                        entry["value"] = point.GetSumDouble();
                        break;
                    case MetricType.LongGauge:
                        entry["value"] = point.GetGaugeLastValueLong();
                        break;
                    case MetricType.DoubleGauge:
                        entry["value"] = point.GetGaugeLastValueDouble();
                        break;
                    case MetricType.Histogram:
                        entry["count"] = point.GetHistogramCount();
                        entry["sum"] = point.GetHistogramSum();
                        break;
                }

                lock (_writer)
                {
                    _writer.WriteLine(JsonSerializer.Serialize(entry));
                }
            }
        }

        return ExportResult.Success;
    }
}
