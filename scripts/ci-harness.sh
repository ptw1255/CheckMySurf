#!/bin/bash
set -uo pipefail

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
NC='\033[0m'

mkdir -p "$RESULTS_DIR"

OVERALL="pass"

# Gate results stored in simple variables (bash 3.x compatible)
BUILD_STATUS="skip"
BUILD_DURATION=0
BUILD_OUTPUT=""
FORMAT_STATUS="skip"
FORMAT_DURATION=0
FORMAT_OUTPUT=""
TEST_STATUS="skip"
TEST_DURATION=0
TEST_OUTPUT=""
REVIEW_STATUS="skip"
REVIEW_DURATION=0
REVIEW_OUTPUT=""

echo ""
echo -e "${BOLD}╔══════════════════════════════════════╗${NC}"
echo -e "${BOLD}║     CI/CD Agentic Harness            ║${NC}"
echo -e "${BOLD}║     Commit: ${COMMIT_SHA}                    ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════╝${NC}"
echo ""

# ─── Gate 1: BUILD ───
echo -e "${BLUE}▶ Gate: build${NC}"
START_MS=$(python3 -c 'import time; print(int(time.time()*1000))')
BUILD_OUTPUT=$(dotnet build "$REPO_ROOT" --no-incremental -warnaserror 2>&1) && BUILD_STATUS="pass" || BUILD_STATUS="fail"
END_MS=$(python3 -c 'import time; print(int(time.time()*1000))')
BUILD_DURATION=$((END_MS - START_MS))

if [ "$BUILD_STATUS" = "pass" ]; then
    echo -e "  ${GREEN}✓ PASS${NC} (${BUILD_DURATION}ms)"
else
    OVERALL="fail"
    echo -e "  ${RED}✗ FAIL${NC} (${BUILD_DURATION}ms)"
    echo "$BUILD_OUTPUT" | head -30 | sed 's/^/    /'
fi
echo ""

# ─── Gate 2: FORMAT ───
echo -e "${BLUE}▶ Gate: format${NC}"
START_MS=$(python3 -c 'import time; print(int(time.time()*1000))')
FORMAT_OUTPUT=$(dotnet format "$REPO_ROOT/dotNetWebApp.sln" --verify-no-changes 2>&1) && FORMAT_STATUS="pass" || FORMAT_STATUS="fail"
END_MS=$(python3 -c 'import time; print(int(time.time()*1000))')
FORMAT_DURATION=$((END_MS - START_MS))

if [ "$FORMAT_STATUS" = "pass" ]; then
    echo -e "  ${GREEN}✓ PASS${NC} (${FORMAT_DURATION}ms)"
else
    OVERALL="fail"
    echo -e "  ${RED}✗ FAIL${NC} (${FORMAT_DURATION}ms)"
    echo "$FORMAT_OUTPUT" | head -30 | sed 's/^/    /'
fi
echo ""

# ─── Gate 3: TEST ───
echo -e "${BLUE}▶ Gate: test${NC}"
START_MS=$(python3 -c 'import time; print(int(time.time()*1000))')
TEST_OUTPUT=$(dotnet test "$REPO_ROOT/DotNetWebApp.Tests/" --filter "Category!=Integration" --no-build -v quiet 2>&1) && TEST_STATUS="pass" || TEST_STATUS="fail"
END_MS=$(python3 -c 'import time; print(int(time.time()*1000))')
TEST_DURATION=$((END_MS - START_MS))

if [ "$TEST_STATUS" = "pass" ]; then
    echo -e "  ${GREEN}✓ PASS${NC} (${TEST_DURATION}ms)"
else
    OVERALL="fail"
    echo -e "  ${RED}✗ FAIL${NC} (${TEST_DURATION}ms)"
    echo "$TEST_OUTPUT" | head -30 | sed 's/^/    /'
fi
echo ""

# ─── Gate 4: CODE REVIEW ───
echo -e "${BLUE}▶ Gate: review${NC}"
DIFF=$(git diff origin/main...HEAD 2>/dev/null || git diff HEAD~1 2>/dev/null || echo "")
if [ -z "$DIFF" ]; then
    REVIEW_STATUS="pass"
    REVIEW_DURATION=0
    REVIEW_OUTPUT="No diff to review"
    echo -e "  ${GREEN}✓ SKIP${NC} (no changes to review)"
else
    START_MS=$(python3 -c 'import time; print(int(time.time()*1000))')

    # Write the diff to a temp file to avoid quoting issues
    DIFF_FILE=$(mktemp)
    echo "$DIFF" > "$DIFF_FILE"

    REVIEW_PROMPT="You are a code reviewer. Review this git diff for:
1. Bugs or logic errors
2. Security vulnerabilities (OWASP top 10)
3. Violations of project conventions (see CLAUDE.md)
4. Code quality issues

For each issue found, output a JSON array of objects with keys: file, line, severity (error or warning), message, suggestion.
If no issues found, output an empty JSON array: []
Output ONLY the JSON array, no other text.

DIFF:
$(cat "$DIFF_FILE")"

    REVIEW_OUTPUT=$(unset CLAUDECODE; echo "$REVIEW_PROMPT" | claude -p --output-format text --allowedTools "" 2>&1) && REVIEW_STATUS="pass" || REVIEW_STATUS="fail"

    rm -f "$DIFF_FILE"

    END_MS=$(python3 -c 'import time; print(int(time.time()*1000))')
    REVIEW_DURATION=$((END_MS - START_MS))

    # Check if review found issues (non-empty array means issues)
    if echo "$REVIEW_OUTPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); sys.exit(0 if len(d)==0 else 1)" 2>/dev/null; then
        REVIEW_STATUS="pass"
        echo -e "  ${GREEN}✓ PASS${NC} (${REVIEW_DURATION}ms)"
    else
        # If it's not valid JSON or has issues, check if claude command itself failed
        if [ "$REVIEW_STATUS" = "fail" ]; then
            OVERALL="fail"
            echo -e "  ${RED}✗ FAIL${NC} (${REVIEW_DURATION}ms)"
            echo "$REVIEW_OUTPUT" | head -20 | sed 's/^/    /'
        else
            # Claude succeeded but found issues
            REVIEW_STATUS="warning"
            echo -e "  ${YELLOW}⚠ ISSUES FOUND${NC} (${REVIEW_DURATION}ms)"
            echo "$REVIEW_OUTPUT" | head -30 | sed 's/^/    /'
        fi
    fi
fi
echo ""

# ─── Write structured results ───
json_escape() {
    python3 -c "import json,sys; print(json.dumps(sys.stdin.read()))" <<< "$1"
}

BUILD_OUTPUT_ESC=$(json_escape "$BUILD_OUTPUT")
FORMAT_OUTPUT_ESC=$(json_escape "$FORMAT_OUTPUT")
TEST_OUTPUT_ESC=$(json_escape "$TEST_OUTPUT")
REVIEW_OUTPUT_ESC=$(json_escape "$REVIEW_OUTPUT")

cat > "$RESULTS_FILE" << JSONEOF
{
  "timestamp": "$TIMESTAMP",
  "commit": "$COMMIT_SHA",
  "overall": "$OVERALL",
  "gates": {
    "build": {
      "status": "$BUILD_STATUS",
      "duration_ms": $BUILD_DURATION,
      "output": $BUILD_OUTPUT_ESC
    },
    "format": {
      "status": "$FORMAT_STATUS",
      "duration_ms": $FORMAT_DURATION,
      "output": $FORMAT_OUTPUT_ESC
    },
    "test": {
      "status": "$TEST_STATUS",
      "duration_ms": $TEST_DURATION,
      "output": $TEST_OUTPUT_ESC
    },
    "review": {
      "status": "$REVIEW_STATUS",
      "duration_ms": $REVIEW_DURATION,
      "output": $REVIEW_OUTPUT_ESC
    }
  }
}
JSONEOF

# ─── Summary ───
echo -e "${BOLD}════════════════════════════════════════${NC}"
echo -e "${BOLD}Summary:${NC}"
for gate_info in "build:$BUILD_STATUS" "format:$FORMAT_STATUS" "test:$TEST_STATUS" "review:$REVIEW_STATUS"; do
    gate="${gate_info%%:*}"
    status="${gate_info##*:}"
    if [ "$status" = "pass" ]; then
        echo -e "  ${GREEN}✓${NC} $gate"
    elif [ "$status" = "warning" ]; then
        echo -e "  ${YELLOW}⚠${NC} $gate (issues found)"
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
