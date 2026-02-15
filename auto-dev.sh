#!/bin/bash
# auto-dev.sh - Autonomous dev loop
# Script runs HERE (current terminal) for logs.
# Claude runs in tmux session "claude" for you to observe.
#
# Usage:
#   bash auto-dev.sh              # Run until done
#   bash auto-dev.sh --max 5      # Run at most 5 sessions
#   bash auto-dev.sh --dry-run    # Preview only
#
# Observe claude:  tmux attach -t claude
# Stop:            Ctrl+C in this terminal

set -euo pipefail
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

# ── Config ──────────────────────────────────────────────────────────
MAX_SESSIONS=50
MAX_CONSECUTIVE_FAILS=3
SESSION_TIMEOUT=600
LOG_DIR="$PROJECT_DIR/logs/auto-dev"
TMUX_SESSION="claude"
DONE_FLAG="$PROJECT_DIR/.claude-session-done"

# ── Parse args ──────────────────────────────────────────────────────
DRY_RUN=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --max)     MAX_SESSIONS="$2"; shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    *)         echo "Unknown arg: $1"; exit 1 ;;
  esac
done

mkdir -p "$LOG_DIR"

# ── Helpers ─────────────────────────────────────────────────────────
remaining_features() {
  python3 -c "
import json
features = json.load(open('features.json'))
print(len([f for f in features if not f['passes']]))
"
}

next_feature() {
  python3 -c "
import json
features = json.load(open('features.json'))
for f in features:
    if not f['passes']:
        print(f'{f[\"id\"]}|{f[\"description\"]}')
        break
"
}

ts() { date '+%Y-%m-%d %H:%M:%S'; }

# ── Build prompt ────────────────────────────────────────────────────
build_prompt() {
  local fid="$1" fdesc="$2" left="$3"
  cat <<PROMPT
你是一个全自动开发 agent。不要问任何问题，不要等待确认，直接执行。

## 任务
实现 features.json 中 id=$fid 的功能："$fdesc"
剩余未完成: $left

## 步骤（严格按顺序）
1. 读 claude-progress.txt 了解上下文
2. 读 features.json 找 id=$fid 的完整定义（含 verification）
3. 读相关源码，理解现有结构
4. 实现功能，改动尽量少
5. cd frontend && npm run build 确认编译通过
6. bash init.sh 确认 smoke test 通过
7. 失败则修复重试（最多 3 次）
8. 通过后把 features.json 中 id=$fid 的 passes 改为 true
9. git add -A && git commit -m "feat(#$fid): $fdesc"
10. 更新 claude-progress.txt

## 规则
- 不改其他 feature 的 passes
- 不删已有功能代码（除非修 bug）
- 不问问题，全程自动
- 无法解决则在 claude-progress.txt 记录错误后结束
- 只做这一个 feature
PROMPT
}

# Wait for claude to finish inside tmux by polling a done-flag file
wait_for_session() {
  local timeout="$1"
  local elapsed=0
  while [ ! -f "$DONE_FLAG" ]; do
    sleep 2
    elapsed=$((elapsed + 2))
    if [ "$elapsed" -ge "$timeout" ]; then
      # Kill the tmux session on timeout
      tmux send-keys -t "$TMUX_SESSION" C-c 2>/dev/null || true
      sleep 2
      tmux kill-session -t "$TMUX_SESSION" 2>/dev/null || true
      return 124
    fi
    # Check if tmux session still alive
    if ! tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
      return 0
    fi
  done
  return 0
}

# ── Main Loop ───────────────────────────────────────────────────────
echo "╔══════════════════════════════════════════╗"
echo "║     Auto Development Loop                ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "  Max sessions:  $MAX_SESSIONS"
echo "  Timeout/each:  ${SESSION_TIMEOUT}s"
echo "  Logs:          $LOG_DIR/"
echo "  Claude runs in: tmux attach -t $TMUX_SESSION"
echo "  Started:       $(ts)"
echo ""

consecutive_fails=0
session_num=0

while true; do
  LEFT=$(remaining_features)

  if [ "$LEFT" = "0" ]; then
    echo "$(ts) ✓ ALL FEATURES COMPLETE"
    break
  fi

  session_num=$((session_num + 1))
  if [ "$session_num" -gt "$MAX_SESSIONS" ]; then
    echo "$(ts) ✗ Hit max sessions ($MAX_SESSIONS)"
    break
  fi

  if [ "$consecutive_fails" -ge "$MAX_CONSECUTIVE_FAILS" ]; then
    echo "$(ts) ✗ Stuck: $MAX_CONSECUTIVE_FAILS sessions with no progress"
    echo "  Check logs and claude-progress.txt for details"
    break
  fi

  IFS='|' read -r FEATURE_ID FEATURE_DESC <<< "$(next_feature)"
  LOG_FILE="$LOG_DIR/session-${session_num}-feature-${FEATURE_ID}.log"
  PROMPT=$(build_prompt "$FEATURE_ID" "$FEATURE_DESC" "$LEFT")

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "$(ts) | Session #$session_num | Feature #$FEATURE_ID | Left: $LEFT"
  echo "  → $FEATURE_DESC"

  if [ "$DRY_RUN" = true ]; then
    echo "  [DRY RUN] skipping"
    session_num=$((session_num - 1))
    break
  fi

  # ── Prepare tmux session ──
  # Kill stale session if any
  tmux kill-session -t "$TMUX_SESSION" 2>/dev/null || true
  rm -f "$DONE_FLAG"

  # Write prompt to temp file (avoids shell quoting hell in tmux send-keys)
  PROMPT_FILE=$(mktemp /tmp/claude-prompt-XXXXXX.txt)
  echo "$PROMPT" > "$PROMPT_FILE"

  # Launch claude inside tmux, log to file, touch done-flag when finished
  tmux new-session -d -s "$TMUX_SESSION" -c "$PROJECT_DIR" \
    "claude -p \"\$(cat $PROMPT_FILE)\" --dangerously-skip-permissions 2>&1 | tee $LOG_FILE; rm -f $PROMPT_FILE; touch $DONE_FLAG; echo ''; echo 'Session complete. Window closes in 10s...'; sleep 10"

  echo "  ⏳ Running in tmux '$TMUX_SESSION'... (tmux attach -t $TMUX_SESSION to watch)"

  # ── Wait for it to finish ──
  set +e
  wait_for_session "$SESSION_TIMEOUT"
  EXIT_CODE=$?
  set -e
  rm -f "$DONE_FLAG" "$PROMPT_FILE"

  if [ "$EXIT_CODE" = "124" ]; then
    echo "  ⚠ TIMEOUT after ${SESSION_TIMEOUT}s"
  else
    echo "  ✔ Session finished"
  fi

  # ── Check progress ──
  NEW_LEFT=$(remaining_features)
  if [ "$NEW_LEFT" -lt "$LEFT" ]; then
    echo "  ✓ Feature #$FEATURE_ID completed. Remaining: $NEW_LEFT"
    consecutive_fails=0
  else
    consecutive_fails=$((consecutive_fails + 1))
    echo "  ✗ NO PROGRESS (fail $consecutive_fails/$MAX_CONSECUTIVE_FAILS)"
  fi
  echo ""
  sleep 2
done

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║              Summary                     ║"
echo "╠══════════════════════════════════════════╣"
echo "  Sessions:   $session_num"
echo "  Remaining:  $(remaining_features) features"
echo "  Finished:   $(ts)"
echo "╚══════════════════════════════════════════╝"
