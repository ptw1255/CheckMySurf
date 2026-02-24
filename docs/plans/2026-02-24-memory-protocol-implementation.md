# Agentic Memory Layer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a file-based memory protocol so agents naturally read, report, and persist learnings across sessions.

**Architecture:** Four markdown files in the memory directory serve as shared state. CLAUDE.md instructions teach agents the protocol. The orchestrator is the sole writer; subagents read and report back.

**Tech Stack:** Markdown files, CLAUDE.md instructions. No app code.

**Design doc:** `docs/plans/2026-02-24-memory-protocol-design.md`

---

### Task 1: Create the memory directory and MEMORY.md index

**Files:**
- Create: `~/.claude/projects/-Users-parker-VSCode-dotNetWebApp/memory/MEMORY.md`

**Step 1: Create the memory directory**

```bash
mkdir -p ~/.claude/projects/-Users-parker-VSCode-dotNetWebApp/memory
```

**Step 2: Write MEMORY.md**

This is the index file that gets auto-loaded into every conversation. Seed it with known facts from this session.

```markdown
# Project Memory — CheckMySurf

> Last updated: 2026-02-24

## Quick Facts

- **App**: ASP.NET Core (.NET 10) weather/surf dashboard for NC beaches
- **Backend**: Single-file architecture — everything in `Program.cs`
- **Frontend**: Inline HTML/CSS/JS in `wwwroot/index.html`
- **Data**: Open-Meteo APIs (weather + marine), no API key, cached in-memory, refreshed every 5 min
- **Port**: http://localhost:5103
- **Repo**: github.com/ptw1255/CheckMySurf (push via SSH as ptw1255)
- **Git auth**: SSH key `~/.ssh/id_ed25519` linked to ptw1255 GitHub account. HTTPS auth is parkerwall_microsoft (work account) — cannot push to ptw1255 repos via HTTPS.

## Active Work

- Multi-beach support: Design approved, implementation plan written (`docs/plans/2026-02-24-multi-beach-implementation.md`), not yet executed
- Memory protocol: This system — being set up now

## Topic Files

- [codebase.md](codebase.md) — Architecture learnings, gotchas, file relationships
- [preferences.md](preferences.md) — User workflow and communication preferences
- [session-log.md](session-log.md) — Rolling handoff log (last 5 sessions)
```

**Step 3: Verify the file is in the right location**

```bash
cat ~/.claude/projects/-Users-parker-VSCode-dotNetWebApp/memory/MEMORY.md
```

Expected: The file contents appear and will be auto-loaded in future conversations.

---

### Task 2: Create codebase.md with known learnings

**Files:**
- Create: `~/.claude/projects/-Users-parker-VSCode-dotNetWebApp/memory/codebase.md`

**Step 1: Write codebase.md**

Seed with everything we've learned about this project across this session.

```markdown
# Codebase Learnings

## Git & GitHub Setup
- **Fact**: Remote is SSH (`git@github.com:ptw1255/CheckMySurf.git`). HTTPS fails because local git credential is parkerwall_microsoft (work account), which doesn't have push access to ptw1255 repos.
- **Confidence**: high
- **Source**: Initial session — failed HTTPS push, switched to SSH
- **Verified**: 2026-02-24

## Open-Meteo API
- **Fact**: No API key required. Free tier supports multiple sequential requests (8 calls every 5 min is fine). Marine API is at `marine-api.open-meteo.com`, weather at `api.open-meteo.com`.
- **Confidence**: high
- **Source**: Initial session — app fetches successfully
- **Verified**: 2026-02-24

## Wave Data Nullability
- **Fact**: Open-Meteo marine hourly data can return null values for wave height, period, and direction. Always use `?? 0` when reading these fields.
- **Confidence**: high
- **Source**: Code review of Program.cs lines 203-205
- **Verified**: 2026-02-24

## Sea Surface Temperature
- **Fact**: Sea surface temp is extracted by taking the last non-null value from the hourly array. This is a workaround — Open-Meteo doesn't always have current SST.
- **Confidence**: medium
- **Source**: Code review of Program.cs line 192-193
- **Verified**: 2026-02-24

## Frontend State
- **Fact**: User preferences (skill level, wave range, cold tolerance) are stored in localStorage under key `surfPrefs`. No server-side user state exists.
- **Confidence**: high
- **Source**: Code review of index.html
- **Verified**: 2026-02-24

## CI Harness
- **Fact**: A pre-push quality gate exists at `scripts/ci-harness.sh`. It runs build, format check, tests (mocked only), and Claude code review. Always push with `git push` (never `--no-verify`).
- **Confidence**: high
- **Source**: CLAUDE.md CI Harness section
- **Verified**: 2026-02-24

## Test Project
- **Fact**: `DotNetWebApp.Tests/` contains xUnit tests with a `CustomWebAppFactory` that mocks HttpClient. Integration tests are tagged `Category=Integration` and hit real APIs. Mocked tests use canned JSON fixtures in `Fixtures/`.
- **Confidence**: high
- **Source**: CLAUDE.md Project Structure section
- **Verified**: 2026-02-24
```

---

### Task 3: Create preferences.md with known user preferences

**Files:**
- Create: `~/.claude/projects/-Users-parker-VSCode-dotNetWebApp/memory/preferences.md`

**Step 1: Write preferences.md**

```markdown
# User Preferences

## Workflow
- **Fact**: Parker uses the brainstorming skill before features, writing-plans for implementation, and expects agentic development with design-before-code workflow.
- **Confidence**: high
- **Source**: Multi-beach and memory protocol design sessions
- **Verified**: 2026-02-24

## Communication
- **Fact**: Parker prefers concise responses. Answers "yes" to approve designs — don't ask for elaboration when approval is clear.
- **Confidence**: high
- **Source**: Observed across full session
- **Verified**: 2026-02-24

## Git
- **Fact**: Parker wants commits when asked, not proactively. Prefers descriptive commit messages. Uses GitHub (ptw1255/CheckMySurf).
- **Confidence**: high
- **Source**: Initial session — committed on request
- **Verified**: 2026-02-24

## Development Style
- **Fact**: Parker is interested in agentic development patterns — parallel agents, skills, structured workflows. Comfortable with multi-step autonomous work.
- **Confidence**: high
- **Source**: Explicit request to build memory layer, multi-beach feature with full brainstorming/planning cycle
- **Verified**: 2026-02-24
```

---

### Task 4: Create session-log.md with this session's handoff

**Files:**
- Create: `~/.claude/projects/-Users-parker-VSCode-dotNetWebApp/memory/session-log.md`

**Step 1: Write session-log.md**

```markdown
# Session Log

## Session 2026-02-24 — Project setup, multi-beach design, memory protocol
- **Worked on**: Initial git setup, CLAUDE.md authoring, GitHub SSH setup, pushed to ptw1255/CheckMySurf. Designed and planned multi-beach support (4 NC beaches). Designed and implemented agentic memory protocol.
- **Unfinished**: Multi-beach implementation plan exists at `docs/plans/2026-02-24-multi-beach-implementation.md` but has NOT been executed. No code changes for multi-beach yet.
- **Learned**: HTTPS git auth uses parkerwall_microsoft (work account) — must use SSH for ptw1255 repos. Open-Meteo free tier handles 8 calls/5min fine. Parker prefers design-first agentic workflows.
- **Next**: Execute the multi-beach implementation plan (7 tasks). Then consider additional features (alerts, historical data, mobile).
```

---

### Task 5: Add Memory Protocol section to CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Add the Memory Protocol section to the end of CLAUDE.md**

Append after the Dependencies section:

```markdown
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
```

**Step 2: Verify CLAUDE.md is still well-formed**

Read the full file and confirm the new section integrates cleanly with existing content.

**Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add memory protocol instructions to CLAUDE.md"
```

---

### Task 6: Verify the full memory system works

**Step 1: Verify MEMORY.md is in the auto-load path**

```bash
cat ~/.claude/projects/-Users-parker-VSCode-dotNetWebApp/memory/MEMORY.md
```

Expected: Contents display correctly.

**Step 2: Verify all memory files exist**

```bash
ls -la ~/.claude/projects/-Users-parker-VSCode-dotNetWebApp/memory/
```

Expected: 4 files — MEMORY.md, codebase.md, preferences.md, session-log.md

**Step 3: Verify CLAUDE.md has the Memory Protocol section**

```bash
grep "Memory Protocol" CLAUDE.md
```

Expected: Match found.

**Step 4: Commit all memory files and push**

Memory files are outside the repo (in `~/.claude/`), so they don't need git tracking. Only the CLAUDE.md change needs pushing.

```bash
git push origin main
```
