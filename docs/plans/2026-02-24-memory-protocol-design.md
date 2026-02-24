# Agentic Memory Layer Design

**Date:** 2026-02-24
**Status:** Approved

## Overview

A file-based memory protocol that keeps context fresh across agents and sessions. No infrastructure — just structured markdown files and CLAUDE.md instructions that teach agents how to read, report, and persist learnings.

## Approach

CLAUDE.md Protocol + Structured Memory Files (Approach 1). Memory is entirely file-based. Agents follow the protocol because CLAUDE.md tells them to. The orchestrator (main conversation agent) is the sole writer. Subagents read memory and report learnings back.

## File Structure

```
~/.claude/projects/-Users-parker-VSCode-dotNetWebApp/memory/
  MEMORY.md           # Index (auto-loaded every conversation, <200 lines)
  codebase.md         # Architecture learnings, gotchas, file relationships
  preferences.md      # User workflow/coding/communication preferences
  session-log.md      # Rolling log of last 5 sessions (handoff context)
```

### MEMORY.md (Index)

- Concise summary of the top 10-15 most important facts
- Links to topic files for deeper context
- Last updated timestamp
- Must stay under 200 lines (auto-loaded into every conversation)

### Topic Files (codebase.md, preferences.md)

Each entry follows this format:

```markdown
## [Topic]
- **Fact**: [the learning]
- **Confidence**: high/medium/low
- **Source**: [which session/agent discovered this]
- **Verified**: [date last confirmed true]
```

### session-log.md (Rolling Handoff)

FIFO log of last 5 sessions. Each entry:

```markdown
## Session [date] — [short title]
- **Worked on**: [what was done]
- **Unfinished**: [what's left]
- **Learned**: [key discoveries]
- **Next**: [suggested next steps]
```

## Protocol Rules

### On Session Start (Orchestrator)

1. Read `memory/MEMORY.md` (auto-loaded)
2. If the task relates to a topic file, read that file too
3. Check `memory/session-log.md` for unfinished work

### On Subagent Dispatch

1. Include in the subagent prompt: "Read `memory/codebase.md` before starting. Return any new learnings in a `## Learnings` section at the end of your response."
2. Subagents read memory but never write to it

### On Subagent Return

1. Orchestrator checks for a `## Learnings` section in the response
2. Evaluate each learning: is it new? Is it correct? Does it contradict existing memory?
3. Persist worthy learnings to the appropriate topic file

### On Session End

1. Write a handoff entry to `memory/session-log.md` (push old entries off if >5)
2. Update `memory/MEMORY.md` index if any new important facts were learned
3. Update topic files if relevant

### Memory Hygiene

- MEMORY.md must stay under 200 lines
- Topic files have no hard limit but should stay focused
- If a fact is discovered wrong, delete it immediately
- Don't duplicate CLAUDE.md content in memory files
- Confidence levels: `high` = verified multiple times, `medium` = observed once, `low` = inferred

## What Gets Remembered

- Architectural patterns confirmed by reading code
- Gotchas and debugging insights
- User preferences stated explicitly
- File relationships and dependencies
- Things that failed and why
- Session continuity (unfinished work, next steps)

## What Does NOT Get Remembered

- Anything already in CLAUDE.md (no duplication)
- Temporary state (current branch, running PIDs)
- Speculative conclusions from one file read
- Obvious language/framework behavior
- Anything the user asks to forget

## What We're NOT Building

- No custom skills — just CLAUDE.md instructions
- No JSON schema — markdown is the format
- No automated decay — manual cleanup only
- No cross-project memory — scoped to this repo
- No app code changes — purely development workflow
