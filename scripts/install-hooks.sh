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
