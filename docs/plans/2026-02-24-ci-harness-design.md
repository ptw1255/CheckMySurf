# CI/CD Agentic Harness Design

**Status:** Approved
**Date:** 2026-02-24

## Overview

A local pre-push quality gate harness that blocks `git push` when code quality checks fail. Outputs structured results so Claude Code agents can read failures, fix issues, and retry in a loop until all gates pass.

## Architecture

### Harness Script (`scripts/ci-harness.sh`)

Single bash script running 4 gates sequentially. All gates run regardless of prior failures to produce a complete report.

**Gates:**
1. **BUILD** — `dotnet build --no-incremental -warnaserror`
2. **FORMAT** — `dotnet format --verify-no-changes`
3. **TEST** — `dotnet test --logger "trx"`
4. **CODE REVIEW** — `claude -p` reviewing the git diff for bugs, security issues, and convention violations

**Output:**
- Console: color-coded pass/fail per gate + summary
- File: `.claude/harness-results.json` (structured, gitignored)
- Exit code: 0 if all pass, 1 if any fail

### Results JSON Schema

```json
{
  "timestamp": "ISO-8601",
  "commit": "short-sha",
  "overall": "pass|fail",
  "gates": {
    "build": {
      "status": "pass|fail",
      "duration_ms": 2100,
      "output": "raw build output",
      "errors": []
    },
    "format": {
      "status": "pass|fail",
      "duration_ms": 800,
      "errors": ["file:line description"]
    },
    "test": {
      "status": "pass|fail",
      "duration_ms": 3500,
      "passed": 5,
      "failed": 0,
      "errors": []
    },
    "review": {
      "status": "pass|fail",
      "duration_ms": 45000,
      "issues": [
        {
          "file": "Program.cs",
          "line": 42,
          "severity": "error|warning",
          "message": "description",
          "suggestion": "how to fix"
        }
      ]
    }
  }
}
```

## Test Project (`DotNetWebApp.Tests/`)

xUnit test project targeting .NET 10 with `Microsoft.AspNetCore.Mvc.Testing`.

### Test Categories

**Mocked tests (default, run by harness):**
- `/api/weather` returns 200 and valid JSON structure
- `/api/beach` returns 200 and valid JSON structure
- Response models have expected fields
- Static files are served (root returns HTML)
- Uses mocked HttpClient with canned Open-Meteo responses — fast, deterministic, offline

**Integration tests (tagged, optional):**
- Same endpoints but with real Open-Meteo API calls
- Tagged with `[Trait("Category", "Integration")]` so they can be excluded from the harness run
- Useful for verifying real API compatibility

## Git Hook

### Pre-push hook (`.git/hooks/pre-push`)

Thin wrapper:
```bash
#!/bin/bash
exec "$(git rev-parse --show-toplevel)/scripts/ci-harness.sh"
```

### Installation (`scripts/install-hooks.sh`)

Idempotent script that copies the pre-push hook into `.git/hooks/` and makes it executable. Safe to re-run.

### Bypass

Standard: `git push --no-verify`

## Agent Feedback Loop

1. Agent runs `git push` — pre-push hook fires — harness runs
2. If any gate fails: harness prints console summary + writes `.claude/harness-results.json`
3. Agent reads results file, understands failures (file paths, line numbers, messages, suggestions)
4. Agent fixes code, commits
5. Agent retries `git push`
6. Loop repeats until all gates pass

### CLAUDE.md Addition

Instructions added to CLAUDE.md telling agents to read `.claude/harness-results.json` when push is blocked.

## File Inventory

| File | Purpose |
|------|---------|
| `scripts/ci-harness.sh` | Main harness script (4 gates) |
| `scripts/install-hooks.sh` | One-time hook installer |
| `DotNetWebApp.Tests/DotNetWebApp.Tests.csproj` | xUnit test project |
| `DotNetWebApp.Tests/ApiTests.cs` | Mocked API endpoint tests |
| `DotNetWebApp.Tests/IntegrationTests.cs` | Real API integration tests |
| `DotNetWebApp.Tests/Fixtures/` | Canned Open-Meteo JSON responses |
| `.claude/harness-results.json` | Runtime results (gitignored) |
| `.gitignore` | Updated to ignore harness results |
| `CLAUDE.md` | Updated with harness instructions |
