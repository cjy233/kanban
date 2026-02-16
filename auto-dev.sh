#!/bin/bash
# auto-dev.sh - Autonomous dev loop
# Claude runs in THIS terminal. You can interact, interrupt, or exit anytime.
# When you exit Claude, the script continues to the next feature.
#
# Usage:
#   bash auto-dev.sh              # Run until done
#   bash auto-dev.sh --max 5      # Run at most 5 sessions
#   bash auto-dev.sh --dry-run    # Preview only
#
# Interact:       Just use the terminal normally
# Stop loop:      Ctrl+C (once, to exit Claude if running)
# Exit Claude:    Type 'exit' to end Claude and continue to next feature

set -euo pipefail
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

# ── Config ──────────────────────────────────────────────────────────
MAX_SESSIONS=50
MAX_CONSECUTIVE_FAILS=3
SESSION_TIMEOUT=600
LOG_DIR="$PROJECT_DIR/logs/auto-dev"

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

check_blocked() {
  if [ -f "BLOCKED.md" ]; then
    echo ""
    echo "╔══════════════════════════════════════════╗"
    echo "║  ⚠ BLOCKED — 需要你的帮助                ║"
    echo "╚══════════════════════════════════════════╝"
    echo ""
    cat BLOCKED.md
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "请按照上面的步骤处理完毕后，按回车继续..."
    read -r
    rm -f BLOCKED.md
    echo "$(ts) BLOCKED.md 已清除，继续循环"
  fi
}

# ── Build prompt ────────────────────────────────────────────────────
build_prompt() {
  local fid="$1" fdesc="$2" left="$3"
  cat <<PROMPT
继续下一个任务。

## 当前任务
features.json 中 id=$fid："$fdesc"
剩余未完成: $left

## 上下文
- 先读 claude-progress.txt 了解项目状态
- 读 features.json 看还有哪些功能待完成
- 读相关源码理解现有结构
- 列出可用 MCP servers 和 tools

## 怎么做
根据当前代码和文档实际情况决定实现方式。
- 改动尽量小
- 完成后把 features.json 中 id=$fid 的 passes 改为 true
- git add -A && git commit -m "feat(#$fid): $fdesc"
- git push
- 更新 claude-progress.txt

## 遇到问题
用 MCP tools、curl、浏览器等自行验证和调试。
无法独立解决时创建 BLOCKED.md 描述需要你做什么。

## 可用 Skills
| 场景 | Skill |
|------|-------|
| UI 开发 | /frontend-design |
| CSS 样式 | /style-design |
| Bug 调试 | /problem-solver |
| 复杂调试 | /superpowers:systematic-debugging |

PROMPT
}

# ── Main Loop ───────────────────────────────────────────────────────
echo "╔══════════════════════════════════════════╗"
echo "║     Auto Development Loop                ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "  Max sessions:  $MAX_SESSIONS"
echo "  Timeout/each:  ${SESSION_TIMEOUT}s"
echo "  Logs:          $LOG_DIR/"
echo "  Claude runs in: THIS terminal (interact freely)"
echo "  Started:       $(ts)"
echo ""

consecutive_fails=0
session_num=0

while true; do
  # 检查是否有阻塞文件需要用户处理
  check_blocked

  LEFT=$(remaining_features)

  if [ "$LEFT" = "0" ]; then
    echo "$(ts) ✓ ALL FEATURES COMPLETE"
    echo ""
    echo "运行最终 code review..."
    cd "$PROJECT_DIR"
    claude --dangerously-skip-permissions "对整个项目做一次 code review，检查代码质量、安全性、可维护性。输出 review 报告。"
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

  # ── Run Claude in current terminal ──
  echo "  ⏳ Starting Claude... (type 'exit' to end and continue)"
  echo ""

  # 直接运行 Claude 并传递 prompt，保持交互式
  cd "$PROJECT_DIR"
  claude --dangerously-skip-permissions "$PROMPT"
  CLAUDE_EXIT=$?
  echo ""
  echo "  ⏹ Claude exited (code: $CLAUDE_EXIT)"

  # 检查是否产生了阻塞文件
  if [ -f "BLOCKED.md" ]; then
    echo "  ⚠ Agent 遇到阻塞，需要你的帮助"
    consecutive_fails=0  # 阻塞不算失败
    continue             # 回到循环顶部，check_blocked 会处理
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
