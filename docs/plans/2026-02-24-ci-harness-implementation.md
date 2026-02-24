# CI/CD Agentic Harness Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a local pre-push quality gate harness with build, format, test, and AI code review gates that outputs structured results for agent feedback loops.

**Architecture:** A bash script (`scripts/ci-harness.sh`) runs 4 sequential gates (build, format, test, code review) as a git pre-push hook. An xUnit test project with mocked HttpClient provides deterministic API tests. Results go to console (human-readable) and `.claude/harness-results.json` (agent-parseable).

**Tech Stack:** .NET 10, xUnit, Microsoft.AspNetCore.Mvc.Testing, bash, Claude Code CLI (`claude -p`)

---

### Task 1: Make Program class testable

The app uses top-level statements, so `Program` is implicitly internal. We need to expose it for `WebApplicationFactory<Program>`.

**Files:**
- Modify: `Program.cs:449` (append at end)

**Step 1: Add partial class declaration**

Add this line at the very end of `Program.cs` (after the closing brace of `FileMetricExporter`):

```csharp
public partial class Program { }
```

**Step 2: Verify build still works**

Run: `dotnet build`
Expected: Build succeeded, 0 warnings, 0 errors

**Step 3: Commit**

```bash
git add Program.cs
git commit -m "feat: expose Program class for test project access"
```

---

### Task 2: Create the xUnit test project

**Files:**
- Create: `DotNetWebApp.Tests/DotNetWebApp.Tests.csproj`

**Step 1: Create test project via CLI**

```bash
mkdir -p DotNetWebApp.Tests
dotnet new xunit -n DotNetWebApp.Tests -o DotNetWebApp.Tests --framework net10.0
```

**Step 2: Add required packages and project reference**

```bash
cd DotNetWebApp.Tests
dotnet add package Microsoft.AspNetCore.Mvc.Testing
dotnet add reference ../DotNetWebApp.csproj
cd ..
```

**Step 3: Add test project to solution**

```bash
dotnet sln add DotNetWebApp.Tests/DotNetWebApp.Tests.csproj
```

**Step 4: Verify solution builds**

Run: `dotnet build`
Expected: Build succeeded for both projects

**Step 5: Delete the auto-generated test file**

Delete `DotNetWebApp.Tests/UnitTest1.cs` (we'll write our own tests).

**Step 6: Commit**

```bash
git add DotNetWebApp.Tests/ dotNetWebApp.sln
git commit -m "feat: add xUnit test project with MVC testing support"
```

---

### Task 3: Create canned Open-Meteo fixture data

These are realistic JSON responses used by mocked tests so they never hit the network.

**Files:**
- Create: `DotNetWebApp.Tests/Fixtures/weather-response.json`
- Create: `DotNetWebApp.Tests/Fixtures/marine-response.json`

**Step 1: Create weather fixture**

Create `DotNetWebApp.Tests/Fixtures/weather-response.json`:

```json
{
  "current": {
    "temperature_2m": 72.5,
    "weather_code": 1,
    "wind_speed_10m": 8.3,
    "relative_humidity_2m": 65
  },
  "daily": {
    "time": ["2026-02-24", "2026-02-25", "2026-02-26", "2026-02-27", "2026-02-28"],
    "temperature_2m_max": [75.0, 73.2, 70.1, 68.5, 71.3],
    "temperature_2m_min": [58.0, 56.5, 54.2, 52.0, 55.8],
    "weather_code": [1, 2, 3, 61, 0]
  }
}
```

**Step 2: Create marine fixture**

Create `DotNetWebApp.Tests/Fixtures/marine-response.json`:

```json
{
  "current": {
    "wave_height": 0.8,
    "wave_period": 8.5,
    "wave_direction": 135.0
  },
  "daily": {
    "time": ["2026-02-24", "2026-02-25", "2026-02-26"],
    "wave_height_max": [1.0, 0.6, 1.2],
    "wave_period_max": [9.0, 7.0, 10.5],
    "wave_direction_dominant": [140.0, 120.0, 160.0]
  },
  "hourly": {
    "time": ["2026-02-24T00:00", "2026-02-24T01:00", "2026-02-24T02:00"],
    "wave_height": [0.7, 0.8, 0.9],
    "wave_period": [8.0, 8.5, 9.0],
    "wave_direction": [130.0, 135.0, 140.0],
    "sea_surface_temperature": [62.5, 62.3, 62.1]
  }
}
```

**Step 3: Mark fixtures as embedded resources in .csproj**

Add to `DotNetWebApp.Tests/DotNetWebApp.Tests.csproj` inside an `<ItemGroup>`:

```xml
<ItemGroup>
  <Content Include="Fixtures\**\*.json">
    <CopyToOutputDirectory>PreserveNewest</CopyToOutputDirectory>
  </Content>
</ItemGroup>
```

**Step 4: Verify build**

Run: `dotnet build`
Expected: Build succeeded

**Step 5: Commit**

```bash
git add DotNetWebApp.Tests/Fixtures/ DotNetWebApp.Tests/DotNetWebApp.Tests.csproj
git commit -m "feat: add canned Open-Meteo JSON fixtures for tests"
```

---

### Task 4: Create custom WebApplicationFactory with mocked HttpClient

This factory intercepts all outgoing HTTP calls and returns our canned fixtures instead of hitting Open-Meteo.

**Files:**
- Create: `DotNetWebApp.Tests/CustomWebAppFactory.cs`

**Step 1: Write the factory**

Create `DotNetWebApp.Tests/CustomWebAppFactory.cs`:

```csharp
using System.Net;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace DotNetWebApp.Tests;

public class CustomWebAppFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureServices(services =>
        {
            // Remove the real IHttpClientFactory and replace with one that uses our mock handler
            var descriptor = services.SingleOrDefault(
                d => d.ServiceType == typeof(IHttpClientFactory));
            if (descriptor != null)
                services.Remove(descriptor);

            // Also remove any HttpClient registrations
            var httpClientDescriptors = services
                .Where(d => d.ServiceType.FullName?.Contains("HttpClient") == true)
                .ToList();
            foreach (var d in httpClientDescriptors)
                services.Remove(d);

            services.AddSingleton<IHttpClientFactory>(sp =>
                new MockHttpClientFactory());
        });
    }
}

public class MockHttpClientFactory : IHttpClientFactory
{
    public HttpClient CreateClient(string name)
    {
        var handler = new MockOpenMeteoHandler();
        return new HttpClient(handler);
    }
}

public class MockOpenMeteoHandler : HttpMessageHandler
{
    protected override async Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var url = request.RequestUri?.ToString() ?? "";
        string json;

        if (url.Contains("marine-api.open-meteo.com"))
        {
            json = await File.ReadAllTextAsync(
                Path.Combine("Fixtures", "marine-response.json"), cancellationToken);
        }
        else if (url.Contains("api.open-meteo.com"))
        {
            json = await File.ReadAllTextAsync(
                Path.Combine("Fixtures", "weather-response.json"), cancellationToken);
        }
        else
        {
            return new HttpResponseMessage(HttpStatusCode.NotFound);
        }

        return new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(json, System.Text.Encoding.UTF8, "application/json")
        };
    }
}
```

**Step 2: Verify build**

Run: `dotnet build`
Expected: Build succeeded

**Step 3: Commit**

```bash
git add DotNetWebApp.Tests/CustomWebAppFactory.cs
git commit -m "feat: add WebApplicationFactory with mocked HttpClient for Open-Meteo"
```

---

### Task 5: Write mocked API endpoint tests

**Files:**
- Create: `DotNetWebApp.Tests/ApiTests.cs`

**Step 1: Write the failing test file**

Create `DotNetWebApp.Tests/ApiTests.cs`:

```csharp
using System.Net;
using System.Text.Json;

namespace DotNetWebApp.Tests;

public class ApiTests : IClassFixture<CustomWebAppFactory>
{
    private readonly HttpClient _client;
    private readonly JsonSerializerOptions _jsonOptions = new() { PropertyNameCaseInsensitive = true };

    public ApiTests(CustomWebAppFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task GetWeather_Returns200()
    {
        var response = await _client.GetAsync("/api/weather");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task GetWeather_ReturnsValidJson()
    {
        var response = await _client.GetAsync("/api/weather");
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
        var response = await _client.GetAsync("/api/weather");
        var content = await response.Content.ReadAsStringAsync();
        var doc = JsonDocument.Parse(content);
        var temp = doc.RootElement.GetProperty("currentTempF").GetDouble();

        // Fixture has 72.5F — sanity check it's in Fahrenheit range (not Celsius)
        Assert.InRange(temp, 30.0, 130.0);
    }

    [Fact]
    public async Task GetBeach_Returns200()
    {
        var response = await _client.GetAsync("/api/beach");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task GetBeach_ReturnsValidJson()
    {
        var response = await _client.GetAsync("/api/beach");
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
        var response = await _client.GetAsync("/api/beach");
        var content = await response.Content.ReadAsStringAsync();
        var doc = JsonDocument.Parse(content);
        var waveHt = doc.RootElement.GetProperty("waveHeightFt").GetDouble();

        // Fixture has 0.8m → 0.8 * 3.281 ≈ 2.6 ft
        Assert.InRange(waveHt, 2.0, 3.5);
    }

    [Fact]
    public async Task GetBeach_QualityScoreInRange()
    {
        var response = await _client.GetAsync("/api/beach");
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
}
```

**Step 2: Run tests to verify they pass**

Run: `dotnet test DotNetWebApp.Tests/ -v normal`
Expected: All 8 tests pass

Note: If tests fail due to startup timing (the app fetches data on startup via the mocked handler), the mocked handler serves fixture data immediately so startup should succeed. If `WebApplicationFactory` has issues with the Timer-based refresh or OpenTelemetry, we may need to adjust `CustomWebAppFactory` to also suppress those. Fix any issues before proceeding.

**Step 3: Commit**

```bash
git add DotNetWebApp.Tests/ApiTests.cs
git commit -m "feat: add mocked API endpoint tests for weather and beach endpoints"
```

---

### Task 6: Write integration tests (real API, tagged)

**Files:**
- Create: `DotNetWebApp.Tests/IntegrationTests.cs`

**Step 1: Write integration tests**

Create `DotNetWebApp.Tests/IntegrationTests.cs`:

```csharp
using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;

namespace DotNetWebApp.Tests;

[Trait("Category", "Integration")]
public class IntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public IntegrationTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task GetWeather_RealApi_Returns200()
    {
        var response = await _client.GetAsync("/api/weather");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var content = await response.Content.ReadAsStringAsync();
        var doc = JsonDocument.Parse(content);
        Assert.True(doc.RootElement.TryGetProperty("currentTempF", out _));
    }

    [Fact]
    public async Task GetBeach_RealApi_Returns200()
    {
        var response = await _client.GetAsync("/api/beach");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var content = await response.Content.ReadAsStringAsync();
        var doc = JsonDocument.Parse(content);
        Assert.True(doc.RootElement.TryGetProperty("waveHeightFt", out _));
    }
}
```

**Step 2: Run only mocked tests (exclude integration)**

Run: `dotnet test DotNetWebApp.Tests/ --filter "Category!=Integration" -v normal`
Expected: 8 mocked tests pass, integration tests skipped

**Step 3: Optionally run integration tests**

Run: `dotnet test DotNetWebApp.Tests/ --filter "Category=Integration" -v normal`
Expected: 2 tests pass (requires network)

**Step 4: Commit**

```bash
git add DotNetWebApp.Tests/IntegrationTests.cs
git commit -m "feat: add integration tests with real Open-Meteo API calls"
```

---

### Task 7: Create the CI harness script

**Files:**
- Create: `scripts/ci-harness.sh`

**Step 1: Create scripts directory and harness**

Create `scripts/ci-harness.sh`:

```bash
#!/bin/bash
set -euo pipefail

# CI/CD Agentic Harness
# Runs 4 quality gates before allowing git push.
# All gates run regardless of prior failures to produce a complete report.
# Output: console (color-coded) + .claude/harness-results.json (structured)

REPO_ROOT="$(git rev-parse --show-toplevel)"
RESULTS_DIR="$REPO_ROOT/.claude"
RESULTS_FILE="$RESULTS_DIR/harness-results.json"
COMMIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Ensure results directory exists
mkdir -p "$RESULTS_DIR"

# Track overall status
OVERALL="pass"
declare -A GATE_STATUS
declare -A GATE_DURATION
declare -A GATE_OUTPUT

echo ""
echo -e "${BOLD}╔══════════════════════════════════════╗${NC}"
echo -e "${BOLD}║     CI/CD Agentic Harness            ║${NC}"
echo -e "${BOLD}║     Commit: ${COMMIT_SHA}                    ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════╝${NC}"
echo ""

# Helper: run a gate and capture results
run_gate() {
    local gate_name="$1"
    local gate_cmd="$2"
    local start_ms
    local end_ms
    local duration_ms
    local output
    local exit_code

    echo -e "${BLUE}▶ Gate: ${gate_name}${NC}"

    start_ms=$(python3 -c 'import time; print(int(time.time()*1000))')

    set +e
    output=$(eval "$gate_cmd" 2>&1)
    exit_code=$?
    set -e

    end_ms=$(python3 -c 'import time; print(int(time.time()*1000))')
    duration_ms=$((end_ms - start_ms))

    GATE_DURATION[$gate_name]=$duration_ms
    GATE_OUTPUT[$gate_name]="$output"

    if [ $exit_code -eq 0 ]; then
        GATE_STATUS[$gate_name]="pass"
        echo -e "  ${GREEN}✓ PASS${NC} (${duration_ms}ms)"
    else
        GATE_STATUS[$gate_name]="fail"
        OVERALL="fail"
        echo -e "  ${RED}✗ FAIL${NC} (${duration_ms}ms)"
        echo -e "  ${YELLOW}Output:${NC}"
        echo "$output" | head -30 | sed 's/^/    /'
        if [ "$(echo "$output" | wc -l)" -gt 30 ]; then
            echo "    ... (truncated, see $RESULTS_FILE for full output)"
        fi
    fi
    echo ""
}

# ─── Gate 1: BUILD ───
run_gate "build" "dotnet build '$REPO_ROOT' --no-incremental -warnaserror 2>&1"

# ─── Gate 2: FORMAT ───
run_gate "format" "dotnet format '$REPO_ROOT' --verify-no-changes 2>&1"

# ─── Gate 3: TEST ───
run_gate "test" "dotnet test '$REPO_ROOT/DotNetWebApp.Tests/' --filter 'Category!=Integration' --no-build -v quiet 2>&1"

# ─── Gate 4: CODE REVIEW ───
# Get the diff of staged/committed changes vs the remote
DIFF=$(git diff origin/main...HEAD 2>/dev/null || git diff HEAD~1 2>/dev/null || echo "")
if [ -z "$DIFF" ]; then
    GATE_STATUS["review"]="pass"
    GATE_DURATION["review"]=0
    GATE_OUTPUT["review"]="No diff to review"
    echo -e "${BLUE}▶ Gate: review${NC}"
    echo -e "  ${GREEN}✓ SKIP${NC} (no changes to review)"
    echo ""
else
    REVIEW_PROMPT="You are a code reviewer. Review this git diff for:
1. Bugs or logic errors
2. Security vulnerabilities (OWASP top 10)
3. Violations of project conventions (see CLAUDE.md)
4. Code quality issues

For each issue found, output a JSON array of objects with keys: file, line, severity (error or warning), message, suggestion.
If no issues found, output an empty JSON array: []
Output ONLY the JSON array, no other text.

DIFF:
$DIFF"

    run_gate "review" "echo '$REVIEW_PROMPT' | claude -p --output-format text --allowedTools '' 2>&1"
fi

# ─── Write structured results ───
# Escape JSON strings safely
json_escape() {
    python3 -c "import json,sys; print(json.dumps(sys.stdin.read()))" <<< "$1"
}

BUILD_OUTPUT_ESC=$(json_escape "${GATE_OUTPUT[build]:-}")
FORMAT_OUTPUT_ESC=$(json_escape "${GATE_OUTPUT[format]:-}")
TEST_OUTPUT_ESC=$(json_escape "${GATE_OUTPUT[test]:-}")
REVIEW_OUTPUT_ESC=$(json_escape "${GATE_OUTPUT[review]:-}")

cat > "$RESULTS_FILE" << JSONEOF
{
  "timestamp": "$TIMESTAMP",
  "commit": "$COMMIT_SHA",
  "overall": "$OVERALL",
  "gates": {
    "build": {
      "status": "${GATE_STATUS[build]:-skip}",
      "duration_ms": ${GATE_DURATION[build]:-0},
      "output": $BUILD_OUTPUT_ESC
    },
    "format": {
      "status": "${GATE_STATUS[format]:-skip}",
      "duration_ms": ${GATE_DURATION[format]:-0},
      "output": $FORMAT_OUTPUT_ESC
    },
    "test": {
      "status": "${GATE_STATUS[test]:-skip}",
      "duration_ms": ${GATE_DURATION[test]:-0},
      "output": $TEST_OUTPUT_ESC
    },
    "review": {
      "status": "${GATE_STATUS[review]:-skip}",
      "duration_ms": ${GATE_DURATION[review]:-0},
      "output": $REVIEW_OUTPUT_ESC
    }
  }
}
JSONEOF

# ─── Summary ───
echo -e "${BOLD}════════════════════════════════════════${NC}"
echo -e "${BOLD}Summary:${NC}"
for gate in build format test review; do
    status="${GATE_STATUS[$gate]:-skip}"
    if [ "$status" = "pass" ]; then
        echo -e "  ${GREEN}✓${NC} $gate"
    elif [ "$status" = "skip" ]; then
        echo -e "  ${YELLOW}○${NC} $gate (skipped)"
    else
        echo -e "  ${RED}✗${NC} $gate"
    fi
done
echo ""

if [ "$OVERALL" = "pass" ]; then
    echo -e "${GREEN}${BOLD}All gates passed. Push allowed.${NC}"
    echo ""
    exit 0
else
    echo -e "${RED}${BOLD}Quality gates failed. Push blocked.${NC}"
    echo -e "Results written to: ${RESULTS_FILE}"
    echo -e "Fix the issues and try again, or use ${YELLOW}git push --no-verify${NC} to bypass."
    echo ""
    exit 1
fi
```

**Step 2: Make it executable**

```bash
chmod +x scripts/ci-harness.sh
```

**Step 3: Test the harness manually**

Run: `./scripts/ci-harness.sh`
Expected: All 4 gates run. Build, format, and test should pass. Review may pass or flag issues. Check that `.claude/harness-results.json` is written.

**Step 4: Commit**

```bash
git add scripts/ci-harness.sh
git commit -m "feat: add CI/CD agentic harness script with 4 quality gates"
```

---

### Task 8: Create the hook installer script

**Files:**
- Create: `scripts/install-hooks.sh`

**Step 1: Write the installer**

Create `scripts/install-hooks.sh`:

```bash
#!/bin/bash
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
HOOKS_DIR="$REPO_ROOT/.git/hooks"
HOOK_FILE="$HOOKS_DIR/pre-push"

echo "Installing git pre-push hook..."

cat > "$HOOK_FILE" << 'HOOKEOF'
#!/bin/bash
exec "$(git rev-parse --show-toplevel)/scripts/ci-harness.sh"
HOOKEOF

chmod +x "$HOOK_FILE"

echo "Done. Pre-push hook installed at: $HOOK_FILE"
echo "The CI harness will run before every 'git push'."
echo "Bypass with: git push --no-verify"
```

**Step 2: Make it executable**

```bash
chmod +x scripts/install-hooks.sh
```

**Step 3: Run the installer**

Run: `./scripts/install-hooks.sh`
Expected: "Done. Pre-push hook installed at: .git/hooks/pre-push"

**Step 4: Verify hook exists**

Run: `cat .git/hooks/pre-push`
Expected: The thin wrapper script calling `scripts/ci-harness.sh`

**Step 5: Commit**

```bash
git add scripts/install-hooks.sh
git commit -m "feat: add git hook installer for pre-push CI harness"
```

---

### Task 9: Update .gitignore

**Files:**
- Modify: `.gitignore`

**Step 1: Add harness results to .gitignore**

Append to `.gitignore`:

```
# CI harness results (ephemeral)
.claude/harness-results.json
```

**Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: gitignore CI harness results file"
```

---

### Task 10: Update CLAUDE.md with harness instructions

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Add CI Harness section**

Add the following after the "Build & Run Commands" section in `CLAUDE.md`:

```markdown
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

### Agent Feedback Loop
When `git push` is blocked by the pre-push hook, read `.claude/harness-results.json` for structured failure details. Each gate includes status, duration, and error output. Fix all issues, commit, and retry the push.
```

**Step 2: Update "No tests" statement**

Change `No tests exist in this project yet.` to:

```markdown
Tests: `dotnet test DotNetWebApp.Tests/` (see CI Harness section below)
```

**Step 3: Update Project Structure**

Add test project and scripts to the Project Structure section:

```
DotNetWebApp.Tests/         # xUnit test project
  ApiTests.cs               # Mocked API endpoint tests
  IntegrationTests.cs       # Real API integration tests (tagged)
  CustomWebAppFactory.cs    # WebApplicationFactory with mocked HttpClient
  Fixtures/                 # Canned Open-Meteo JSON responses
scripts/
  ci-harness.sh             # CI/CD quality gate harness
  install-hooks.sh          # Git hook installer
```

**Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with CI harness and test project docs"
```

---

### Task 11: End-to-end verification

**Step 1: Run the full harness**

Run: `./scripts/ci-harness.sh`
Expected: All 4 gates pass (or review identifies real issues to address)

**Step 2: Check the results file**

Run: Read `.claude/harness-results.json`
Expected: Valid JSON with all gates reporting status

**Step 3: Verify the hook works**

Run: `git push` (if you have a remote and changes to push)
Expected: Harness runs automatically before the push

**Step 4: Verify test filtering**

Run: `dotnet test DotNetWebApp.Tests/ --filter "Category!=Integration" -v normal`
Expected: Only mocked tests run (8 tests)

Run: `dotnet test DotNetWebApp.Tests/ --filter "Category=Integration" -v normal`
Expected: Only integration tests run (2 tests, requires network)
