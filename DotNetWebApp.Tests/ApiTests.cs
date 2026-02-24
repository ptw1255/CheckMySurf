using System.Net;
using System.Text.Json;

namespace DotNetWebApp.Tests;

public class ApiTests : IClassFixture<CustomWebAppFactory>
{
    private readonly HttpClient _client;

    public ApiTests(CustomWebAppFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task GetWeather_Returns200()
    {
        var response = await _client.GetAsync("/api/weather/wrightsville");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task GetWeather_ReturnsValidJson()
    {
        var response = await _client.GetAsync("/api/weather/wrightsville");
        var content = await response.Content.ReadAsStringAsync();
        var doc = JsonDocument.Parse(content);
        var root = doc.RootElement;

        Assert.True(root.TryGetProperty("currentTempF", out _), "Missing currentTempF");
        Assert.True(root.TryGetProperty("condition", out _), "Missing condition");
        Assert.True(root.TryGetProperty("windMph", out _), "Missing windMph");
        Assert.True(root.TryGetProperty("humidityPct", out _), "Missing humidityPct");
        Assert.True(root.TryGetProperty("daily", out var daily), "Missing daily");
        Assert.True(daily.GetArrayLength() >= 1, "Daily array should have entries");
    }

    [Fact]
    public async Task GetWeather_ReturnsFahrenheitTemperature()
    {
        var response = await _client.GetAsync("/api/weather/wrightsville");
        var content = await response.Content.ReadAsStringAsync();
        var doc = JsonDocument.Parse(content);
        var temp = doc.RootElement.GetProperty("currentTempF").GetDouble();

        // Fixture has 72.5F — sanity check it's in Fahrenheit range (not Celsius)
        Assert.InRange(temp, 30.0, 130.0);
    }

    [Fact]
    public async Task GetBeach_Returns200()
    {
        var response = await _client.GetAsync("/api/beach/wrightsville");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task GetBeach_ReturnsValidJson()
    {
        var response = await _client.GetAsync("/api/beach/wrightsville");
        var content = await response.Content.ReadAsStringAsync();
        var doc = JsonDocument.Parse(content);
        var root = doc.RootElement;

        Assert.True(root.TryGetProperty("seaTempF", out _), "Missing seaTempF");
        Assert.True(root.TryGetProperty("waveHeightFt", out _), "Missing waveHeightFt");
        Assert.True(root.TryGetProperty("wavePeriodS", out _), "Missing wavePeriodS");
        Assert.True(root.TryGetProperty("swellDirection", out _), "Missing swellDirection");
        Assert.True(root.TryGetProperty("surfRating", out _), "Missing surfRating");
        Assert.True(root.TryGetProperty("qualityScore", out _), "Missing qualityScore");
        Assert.True(root.TryGetProperty("hourly", out var hourly), "Missing hourly");
        Assert.True(hourly.GetArrayLength() >= 1, "Hourly array should have entries");
        Assert.True(root.TryGetProperty("daily", out var daily), "Missing daily");
        Assert.True(daily.GetArrayLength() >= 1, "Daily array should have entries");
    }

    [Fact]
    public async Task GetBeach_WaveHeightInFeet()
    {
        var response = await _client.GetAsync("/api/beach/wrightsville");
        var content = await response.Content.ReadAsStringAsync();
        var doc = JsonDocument.Parse(content);
        var waveHt = doc.RootElement.GetProperty("waveHeightFt").GetDouble();

        // Fixture has 0.8m → 0.8 * 3.281 ≈ 2.6 ft
        Assert.InRange(waveHt, 2.0, 3.5);
    }

    [Fact]
    public async Task GetBeach_QualityScoreInRange()
    {
        var response = await _client.GetAsync("/api/beach/wrightsville");
        var content = await response.Content.ReadAsStringAsync();
        var doc = JsonDocument.Parse(content);
        var score = doc.RootElement.GetProperty("qualityScore").GetInt32();

        Assert.InRange(score, 0, 100);
    }

    [Fact]
    public async Task RootPath_ReturnsHtml()
    {
        var response = await _client.GetAsync("/");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var contentType = response.Content.Headers.ContentType?.MediaType;
        Assert.Equal("text/html", contentType);
    }

    [Fact]
    public async Task GetBeaches_Returns200WithAllBeaches()
    {
        var response = await _client.GetAsync("/api/beaches");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var content = await response.Content.ReadAsStringAsync();
        var doc = JsonDocument.Parse(content);
        var root = doc.RootElement;

        Assert.Equal(JsonValueKind.Array, root.ValueKind);
        Assert.Equal(4, root.GetArrayLength());

        // Verify first beach has expected properties
        var first = root[0];
        Assert.True(first.TryGetProperty("slug", out _), "Missing slug");
        Assert.True(first.TryGetProperty("name", out _), "Missing name");
        Assert.True(first.TryGetProperty("weatherCity", out _), "Missing weatherCity");
        Assert.True(first.TryGetProperty("qualityScore", out _), "Missing qualityScore");
        Assert.True(first.TryGetProperty("surfRating", out _), "Missing surfRating");
        Assert.True(first.TryGetProperty("waveHeightFt", out _), "Missing waveHeightFt");
        Assert.True(first.TryGetProperty("ratingColor", out _), "Missing ratingColor");
    }
}
