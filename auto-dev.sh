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
你是一个全自动开发 agent。不要问任何问题，不要等待确认，直接执行。

## 任务
实现 features.json 中 id=$fid 的功能："$fdesc"
剩余未完成: $left

## 步骤（严格按顺序）
1. 读 claude-progress.txt 了解上下文
2. 读 features.json 找 id=$fid 的完整定义（含 verification）
3. 读项目文档（docs/plans/ 下的设计文档），理解功能要求
4. 读相关源码，理解现有结构
5. 发现可用工具：列出所有可用的 MCP server 和工具，记住它们以备后续使用
6. 实现功能，改动尽量少
7. 执行验证流程（见下方调试策略）
8. 质量把关：调用 /superpowers:requesting-code-review 对本次改动做 code review
   - 检查代码质量、安全性、可维护性
   - 发现问题则修复后重新验证
   - review 通过后才能继续
9. 通过后把 features.json 中 id=$fid 的 passes 改为 true
10. git add -A && git commit -m "feat(#$fid): $fdesc"
11. git push
12. 更新 claude-progress.txt

## 调试策略（7 级递进）

遇到问题时，按层级从低到高逐级尝试，每级最多重试 2 次，失败则升级：

### L1: 日志分析
- 读错误日志、stack trace、控制台输出
- 定位根因，直接修复

### L2: 构建/测试修复
- 解析编译错误、类型错误、测试失败
- 修复代码后重新运行 cd frontend && npm run build
- 运行 bash init.sh 确认环境正常

### L3: 浏览器验证
- 使用 MCP browser 工具打开页面
- 截图检查 UI 渲染、交互效果、布局问题
- 对比设计文档验证视觉还原度
- 检查控制台是否有前端报错

### L4: API 测试
- 使用 curl/fetch 测试接口响应
- 验证请求参数、响应格式、状态码
- 检查数据流是否正确（前端 → API → 数据库）
- 测试边界情况和错误处理

### L5: MCP 工具
- 调用项目配置的所有可用 MCP server
- 数据库查询验证数据是否正确写入/读取
- 外部服务连通性检查
- 使用任何可用的调试/监控工具

### L6: 降级/跳过
- 非关键功能：简化实现，降级处理
- 记录降级原因到 claude-progress.txt
- 标记 feature 为部分完成，继续下一个

### L7: 阻塞求助
当遇到以下情况时触发：
- 需要外部数据库连接/配置
- 需要第三方 API 密钥或凭证
- 需要服务器/基础设施权限
- 需要用户提供设计稿或资源文件
- 任何 agent 无法独立完成的操作

执行方式：
1. 在项目根目录创建 BLOCKED.md，格式如下：
   ## 阻塞报告
   **Feature:** #$fid - $fdesc
   **问题:** [具体描述无法解决的问题]
   **需要你做的:**
   1. [步骤1: 具体操作]
   2. [步骤2: 具体操作]
   ...
   **完成后:** 脚本会自动检测并继续
2. 更新 claude-progress.txt 记录阻塞状态
3. 正常退出当前 session（不标记 passes 为 true）

## 可用 Skills（按需调用）

你有以下 skills 可以使用，根据当前 feature 的类型主动调用：

| 场景 | Skill | 说明 |
|------|-------|------|
| UI/页面/组件开发 | /frontend-design | 生成高质量前端界面，避免 AI 味 |
| CSS/样式/布局 | /style-design | 样式设计、响应式布局、设计系统 |
| 遇到 bug/测试失败 | /problem-solver | 标准问题处理流程，记录经验 |
| 复杂调试 | /superpowers:systematic-debugging | 系统化调试，根因分析 |
| 实现完成后 | /superpowers:requesting-code-review | 自我 code review，检查质量 |

使用原则：
- 实现 UI 相关 feature 时，先调用 frontend-design 获取设计指导再写代码
- 遇到问题时，先调用 problem-solver 或 systematic-debugging 再动手修
- 不确定是否需要时，调用比不调用好

## 规则
- 不改其他 feature 的 passes
- 不删已有功能代码（除非修 bug）
- 不问问题，全程自动（除非写 BLOCKED.md 求助）
- 只做这一个 feature
- 所有代码注释、文档、提交信息必须使用中文
- 优先使用 MCP 工具而非手动操作
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
