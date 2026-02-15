# 视觉升级与配置管理实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 对服务器监控应用进行全局视觉升级，并新增 Claude Code 配置管理功能

**Architecture:** 渐进式改造，保持现有 Vue 组件结构。先升级全局样式系统，再逐个升级组件，最后新增配置管理页面和后端 API。

**Tech Stack:** Vue 3 + Vite, Express, Monaco Editor, CSS Variables

---

## Phase 1: 视觉升级 (Features #41-48)

### Task 41: 升级全局配色系统

**Files:**
- Modify: `frontend/src/assets/style.css:1-35`

**Step 1: 更新 CSS 变量**

```css
:root {
  --color-primary: #2563eb;
  --color-primary-dark: #1d4ed8;
  --color-success: #10b981;
  --color-danger: #ef4444;
  --color-danger-dark: #dc2626;
  --color-warning: #f59e0b;
  --color-text: #1a1a2e;
  --color-text-secondary: #6b7280;
  --color-bg: #fafbfc;
  --color-card: #ffffff;
  --color-border: #e5e7eb;
  --color-bg-subtle: #f8fafc;
  --color-bg-hover: #f1f5f9;
  --color-chart-grid: #f1f5f9;
  --color-shadow: rgba(0, 0, 0, 0.08);
}

[data-theme="dark"] {
  --color-primary: #3b82f6;
  --color-primary-dark: #2563eb;
  --color-success: #34d399;
  --color-danger: #f87171;
  --color-danger-dark: #ef4444;
  --color-warning: #fbbf24;
  --color-text: #e6edf3;
  --color-text-secondary: #8b949e;
  --color-bg: #0d1117;
  --color-card: #161b22;
  --color-border: #30363d;
  --color-bg-subtle: #161b22;
  --color-bg-hover: #21262d;
  --color-chart-grid: #30363d;
  --color-shadow: rgba(0, 0, 0, 0.3);
}
```

**Step 2: 构建验证**

Run: `cd frontend && npm run build`
Expected: Build successful

**Step 3: 视觉验证**

使用 MCP browser 工具截图检查亮暗主题配色

**Step 4: Commit**

```bash
git add frontend/src/assets/style.css
git commit -m "feat(#41): 升级全局配色系统"
```

---

### Task 42: 卡片组件升级

**Files:**
- Modify: `frontend/src/assets/style.css`

**Step 1: 添加卡片动效样式**

```css
.stat-card,
.chart-container,
.process-table {
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.stat-card:hover,
.chart-container:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px var(--color-shadow);
}
```

**Step 2: 构建验证**

Run: `cd frontend && npm run build`

**Step 3: Commit**

```bash
git add -A && git commit -m "feat(#42): 卡片组件升级 hover 动效"
```

---

### Task 43: 按钮组件升级

**Files:**
- Modify: `frontend/src/assets/style.css`

**Step 1: 添加按钮动效和 loading 状态**

```css
.btn {
  transition: all 0.15s ease;
  position: relative;
}

.btn:active {
  transform: scale(0.97);
}

.btn.loading {
  pointer-events: none;
  opacity: 0.7;
}

.btn.loading::after {
  content: '';
  position: absolute;
  width: 14px;
  height: 14px;
  border: 2px solid transparent;
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  margin-left: 8px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

**Step 2: Commit**

```bash
git add -A && git commit -m "feat(#43): 按钮组件升级动效和 loading 状态"
```

---

### Task 44: 表格组件升级

**Files:**
- Modify: `frontend/src/assets/style.css`
- Modify: `frontend/src/views/Processes.vue`

**Step 1: 添加表格行样式**

```css
.process-table tbody tr {
  transition: background 0.1s ease;
}

.process-table tbody tr:nth-child(even) {
  background: var(--color-bg-subtle);
}

.process-table tbody tr:hover {
  background: var(--color-bg-hover);
}
```

**Step 2: Commit**

```bash
git add -A && git commit -m "feat(#44): 表格组件升级 hover 和斑马纹"
```

---

### Task 45: 页面切换动效

**Files:**
- Modify: `frontend/src/App.vue`
- Modify: `frontend/src/assets/style.css`

**Step 1: 在 App.vue 添加 transition 包裹**

```vue
<router-view v-slot="{ Component }">
  <transition name="page" mode="out-in">
    <component :is="Component" @connection-status="updateStatus" />
  </transition>
</router-view>
```

**Step 2: 添加过渡样式**

```css
.page-enter-active,
.page-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.page-enter-from {
  opacity: 0;
  transform: translateX(10px);
}

.page-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}
```

**Step 3: Commit**

```bash
git add -A && git commit -m "feat(#45): 页面切换 fade+slide 动效"
```

---

### Task 46: 数据更新动效

**Files:**
- Modify: `frontend/src/views/Dashboard.vue`

**Step 1: 为数值添加 CSS transition**

在 .stat-value 类添加：

```css
.stat-value {
  transition: all 0.3s ease;
}
```

**Step 2: Commit**

```bash
git add -A && git commit -m "feat(#46): 数据更新数字过渡动效"
```

---

### Task 47: 骨架屏加载状态

**Files:**
- Modify: `frontend/src/views/Dashboard.vue`
- Modify: `frontend/src/assets/style.css`

**Step 1: 添加骨架屏样式**

```css
.skeleton {
  background: linear-gradient(90deg, var(--color-bg-subtle) 25%, var(--color-bg-hover) 50%, var(--color-bg-subtle) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.skeleton-text {
  height: 1em;
  width: 60%;
}

.skeleton-card {
  height: 100px;
}
```

**Step 2: 在 Dashboard.vue 添加加载状态**

```vue
<template v-if="!dataLoaded">
  <div class="stats-grid">
    <div class="stat-card skeleton skeleton-card"></div>
    <div class="stat-card skeleton skeleton-card"></div>
    <div class="stat-card skeleton skeleton-card"></div>
  </div>
</template>
```

**Step 3: Commit**

```bash
git add -A && git commit -m "feat(#47): 骨架屏 shimmer 加载效果"
```

---

### Task 48: 图表样式升级

**Files:**
- Modify: `frontend/src/views/Dashboard.vue`

**Step 1: 为 Chart.js 添加渐变填充**

在 chart 配置中：

```javascript
const gradient = ctx.createLinearGradient(0, 0, 0, 200);
gradient.addColorStop(0, 'rgba(37, 99, 235, 0.3)');
gradient.addColorStop(1, 'rgba(37, 99, 235, 0)');

// 在 dataset 中使用
backgroundColor: gradient,
fill: true
```

**Step 2: Commit**

```bash
git add -A && git commit -m "feat(#48): 图表渐变填充和 tooltip 升级"
```

---

## Phase 2: 配置管理后端 (Features #49-53)

### Task 49: GET /api/claude-config

**Files:**
- Create: `backend/routes/claude-config.js`
- Modify: `backend/app.js`

**Step 1: 创建路由文件**

```javascript
import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const router = express.Router();

const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const SETTINGS_PATH = path.join(CLAUDE_DIR, 'settings.json');
const GLOBAL_CONFIG_PATH = path.join(os.homedir(), '.claude.json');

async function readJsonFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw err;
  }
}

// GET /api/claude-config - 获取合并配置
router.get('/', async (req, res) => {
  try {
    const [settings, globalConfig] = await Promise.all([
      readJsonFile(SETTINGS_PATH),
      readJsonFile(GLOBAL_CONFIG_PATH)
    ]);
    res.json({
      settings,
      globalConfig,
      merged: {
        env: { ...globalConfig.env, ...settings.env },
        mcpServers: { ...globalConfig.mcpServers, ...settings.mcpServers }
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
```

**Step 2: 在 app.js 注册路由**

```javascript
import claudeConfigRouter from './routes/claude-config.js';
app.use('/api/claude-config', claudeConfigRouter);
```

**Step 3: 测试 API**

Run: `curl http://localhost:7777/api/claude-config`
Expected: 返回 JSON 配置对象

**Step 4: Commit**

```bash
git add -A && git commit -m "feat(#49): GET /api/claude-config 获取合并配置"
```

---

### Task 50: PUT /api/claude-config/env

**Files:**
- Modify: `backend/routes/claude-config.js`

**Step 1: 添加环境变量更新接口**

```javascript
// PUT /api/claude-config/env - 更新环境变量
router.put('/env', async (req, res) => {
  try {
    const { env } = req.body;
    const settings = await readJsonFile(SETTINGS_PATH);

    // 备份
    await fs.copyFile(SETTINGS_PATH, SETTINGS_PATH + '.bak').catch(() => {});

    settings.env = { ...settings.env, ...env };
    await fs.writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2));

    res.json({ success: true, env: settings.env });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

**Step 2: Commit**

```bash
git add -A && git commit -m "feat(#50): PUT /api/claude-config/env 更新环境变量"
```

---

### Task 51: MCP 服务器 CRUD

**Files:**
- Modify: `backend/routes/claude-config.js`

**Step 1: 添加 MCP 服务器接口**

```javascript
// GET /api/claude-config/mcp
router.get('/mcp', async (req, res) => {
  const settings = await readJsonFile(SETTINGS_PATH);
  res.json(settings.mcpServers || {});
});

// POST /api/claude-config/mcp
router.post('/mcp', async (req, res) => {
  const { name, config } = req.body;
  const settings = await readJsonFile(SETTINGS_PATH);
  await fs.copyFile(SETTINGS_PATH, SETTINGS_PATH + '.bak').catch(() => {});
  settings.mcpServers = settings.mcpServers || {};
  settings.mcpServers[name] = config;
  await fs.writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2));
  res.json({ success: true });
});

// PUT /api/claude-config/mcp/:name
router.put('/mcp/:name', async (req, res) => {
  const { name } = req.params;
  const { config } = req.body;
  const settings = await readJsonFile(SETTINGS_PATH);
  await fs.copyFile(SETTINGS_PATH, SETTINGS_PATH + '.bak').catch(() => {});
  if (settings.mcpServers?.[name]) {
    settings.mcpServers[name] = config;
    await fs.writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2));
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'MCP server not found' });
  }
});

// DELETE /api/claude-config/mcp/:name
router.delete('/mcp/:name', async (req, res) => {
  const { name } = req.params;
  const settings = await readJsonFile(SETTINGS_PATH);
  await fs.copyFile(SETTINGS_PATH, SETTINGS_PATH + '.bak').catch(() => {});
  if (settings.mcpServers?.[name]) {
    delete settings.mcpServers[name];
    await fs.writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2));
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'MCP server not found' });
  }
});
```

**Step 2: Commit**

```bash
git add -A && git commit -m "feat(#51): MCP 服务器 CRUD 接口"
```

---

### Task 52: CLAUDE.md 读写接口

**Files:**
- Modify: `backend/routes/claude-config.js`

**Step 1: 添加 CLAUDE.md 接口**

```javascript
// GET /api/claude-config/claudemd
router.get('/claudemd', async (req, res) => {
  const { path: filePath } = req.query;
  if (!filePath || !filePath.endsWith('.md')) {
    return res.status(400).json({ error: '只允许读取 .md 文件' });
  }
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    res.json({ content, path: filePath });
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.json({ content: '', path: filePath, exists: false });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// PUT /api/claude-config/claudemd
router.put('/claudemd', async (req, res) => {
  const { path: filePath, content } = req.body;
  if (!filePath || !filePath.endsWith('.md')) {
    return res.status(400).json({ error: '只允许写入 .md 文件' });
  }
  try {
    await fs.writeFile(filePath, content, 'utf-8');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

**Step 2: Commit**

```bash
git add -A && git commit -m "feat(#52): CLAUDE.md 读写接口"
```

---

### Task 53: 配置备份恢复接口

**Files:**
- Modify: `backend/routes/claude-config.js`

**Step 1: 添加备份恢复接口**

```javascript
const BACKUP_DIR = path.join(CLAUDE_DIR, 'backups');

// POST /api/claude-config/backup
router.post('/backup', async (req, res) => {
  await fs.mkdir(BACKUP_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(BACKUP_DIR, `settings-${timestamp}.json`);
  const settings = await readJsonFile(SETTINGS_PATH);
  await fs.writeFile(backupPath, JSON.stringify(settings, null, 2));
  res.json({ success: true, backupId: `settings-${timestamp}` });
});

// GET /api/claude-config/backups
router.get('/backups', async (req, res) => {
  try {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
    const files = await fs.readdir(BACKUP_DIR);
    const backups = files.filter(f => f.endsWith('.json')).map(f => ({
      id: f.replace('.json', ''),
      filename: f
    }));
    res.json(backups);
  } catch (err) {
    res.json([]);
  }
});

// POST /api/claude-config/restore/:id
router.post('/restore/:id', async (req, res) => {
  const backupPath = path.join(BACKUP_DIR, `${req.params.id}.json`);
  try {
    const backup = await fs.readFile(backupPath, 'utf-8');
    await fs.copyFile(SETTINGS_PATH, SETTINGS_PATH + '.bak').catch(() => {});
    await fs.writeFile(SETTINGS_PATH, backup);
    res.json({ success: true });
  } catch (err) {
    res.status(404).json({ error: '备份不存在' });
  }
});
```

**Step 2: Commit**

```bash
git add -A && git commit -m "feat(#53): 配置备份恢复接口"
```

---

## Phase 3: 配置管理前端 (Features #54-58)

### Task 54: 新增 /config 路由

**Files:**
- Modify: `frontend/src/main.js`
- Modify: `frontend/src/App.vue`
- Create: `frontend/src/views/ConfigPage.vue`

**Step 1: 创建空的 ConfigPage.vue**

```vue
<template>
  <div class="config-page">
    <h1 class="page-title">配置管理</h1>
    <p>配置页面开发中...</p>
  </div>
</template>

<script setup>
</script>

<style scoped>
.config-page {
  padding: 20px;
}
</style>
```

**Step 2: 在 main.js 添加路由**

```javascript
import ConfigPage from './views/ConfigPage.vue'

const routes = [
  { path: '/', component: Dashboard },
  { path: '/processes', component: Processes },
  { path: '/config', component: ConfigPage }
]
```

**Step 3: 在 App.vue 导航栏添加链接**

```vue
<router-link to="/config">配置</router-link>
```

**Step 4: Commit**

```bash
git add -A && git commit -m "feat(#54): 新增 /config 路由和导航入口"
```

---

### Task 55: 环境变量 Tab

**Files:**
- Modify: `frontend/src/views/ConfigPage.vue`

**Step 1: 实现环境变量表单**

包含：模型选择下拉、API 地址输入、Token 脱敏显示、保存按钮

**Step 2: Commit**

```bash
git add -A && git commit -m "feat(#55): ConfigPage 环境变量 Tab"
```

---

### Task 56: MCP 服务器 Tab

**Files:**
- Modify: `frontend/src/views/ConfigPage.vue`

**Step 1: 实现 MCP 服务器列表和表单**

包含：服务器列表、添加/编辑/删除操作

**Step 2: Commit**

```bash
git add -A && git commit -m "feat(#56): ConfigPage MCP 服务器 Tab"
```

---

### Task 57: CLAUDE.md Tab + Monaco Editor

**Files:**
- Modify: `frontend/src/views/ConfigPage.vue`
- Run: `cd frontend && npm install monaco-editor`

**Step 1: 安装 Monaco Editor**

```bash
cd frontend && npm install monaco-editor
```

**Step 2: 集成编辑器**

```vue
<template>
  <div ref="editorContainer" class="editor-container"></div>
</template>

<script setup>
import * as monaco from 'monaco-editor';
import { ref, onMounted, onUnmounted, watch } from 'vue';

const editorContainer = ref(null);
let editor = null;

onMounted(() => {
  editor = monaco.editor.create(editorContainer.value, {
    value: '',
    language: 'markdown',
    theme: isDark.value ? 'vs-dark' : 'vs',
    automaticLayout: true,
    wordWrap: 'on'
  });
});

onUnmounted(() => {
  editor?.dispose();
});
</script>
```

**Step 3: Commit**

```bash
git add -A && git commit -m "feat(#57): CLAUDE.md Tab 集成 Monaco Editor"
```

---

### Task 58: 未保存离开提示

**Files:**
- Modify: `frontend/src/views/ConfigPage.vue`

**Step 1: 添加 beforeunload 和路由守卫**

```javascript
const hasUnsavedChanges = ref(false);

onMounted(() => {
  window.addEventListener('beforeunload', handleBeforeUnload);
});

onUnmounted(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload);
});

const handleBeforeUnload = (e) => {
  if (hasUnsavedChanges.value) {
    e.preventDefault();
    e.returnValue = '';
  }
};

// 路由守卫
onBeforeRouteLeave((to, from, next) => {
  if (hasUnsavedChanges.value) {
    if (confirm('有未保存的更改，确定离开吗？')) {
      next();
    } else {
      next(false);
    }
  } else {
    next();
  }
});
```

**Step 2: Commit**

```bash
git add -A && git commit -m "feat(#58): 未保存离开提示"
```

---

## 验证清单

完成所有 Task 后：

1. `bash init.sh` - 环境验证通过
2. 亮暗主题切换正常
3. 卡片/按钮/表格动效流畅
4. 页面切换有过渡动画
5. `/config` 页面三个 Tab 功能正常
6. Monaco Editor 可编辑 CLAUDE.md
7. 配置保存/备份/恢复正常nst CLAUDE_DIR = path.join(os.homedir(), '.claude');
const SETTINGS_PATH = path.join(CLAUDE_DIR, 'settings.json');
const GLOBAL_CONFIG_PATH = path.join(os.homedir(), '.claude.json');

// 读取 JSON 文件，不存在返回空对象
async function readJsonFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

// GET /api/claude-config - 获取合并配置
router.get('/', async (req, res) => {
  try {
    const settings = await readJsonFile(SETTINGS_PATH);
    const globalConfig = await readJsonFile(GLOBAL_CONFIG_PATH);

    // settings.json 优先级高于 .claude.json
    const merged = {
      env: { ...globalConfig.env, ...settings.env },
      mcpServers: { ...globalConfig.mcpServers, ...settings.mcpServers },
      _sources: {
        settings: SETTINGS_PATH,
        global: GLOBAL_CONFIG_PATH
      }
    };

    res.json(merged);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
```

**Step 2: 在 app.js 注册路由**

```javascript
import claudeConfigRouter from './routes/claude-config.js';
app.use('/api/claude-config', claudeConfigRouter);
```

**Step 3: 测试**

Run: `curl http://localhost:7777/api/claude-config`
Expected: 返回合并后的配置 JSON

**Step 4: Commit**

```bash
git add -A && git commit -m "feat(#49): GET /api/claude-config 获取合并配置"
```

---

### Task 50: PUT /api/claude-config/env

**Files:**
- Modify: `backend/routes/claude-config.js`

**Step 1: 添加环境变量更新接口**

```javascript
// 写入前备份
async function backupFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    await fs.writeFile(filePath + '.bak', content);
  } catch {}
}

// PUT /api/claude-config/env
router.put('/env', async (req, res) => {
  try {
    const { env } = req.body;
    if (!env || typeof env !== 'object') {
      return res.status(400).json({ error: 'Invalid env object' });
    }

    await backupFile(SETTINGS_PATH);
    const settings = await readJsonFile(SETTINGS_PATH);
    settings.env = { ...settings.env, ...env };

    await fs.writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2));
    res.json({ success: true, env: settings.env });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

**Step 2: Commit**

```bash
git add -A && git commit -m "feat(#50): PUT /api/claude-config/env 更新环境变量"
```

---

### Task 51: MCP 服务器 CRUD

**Files:**
- Modify: `backend/routes/claude-config.js`

**Step 1: 添加 MCP 服务器接口**

```javascript
// GET /api/claude-config/mcp
router.get('/mcp', async (req, res) => {
  const settings = await readJsonFile(SETTINGS_PATH);
  res.json(settings.mcpServers || {});
});

// POST /api/claude-config/mcp
router.post('/mcp', async (req, res) => {
  const { name, command, args, env } = req.body;
  if (!name || !command) {
    return res.status(400).json({ error: 'name and command required' });
  }

  await backupFile(SETTINGS_PATH);
  const settings = await readJsonFile(SETTINGS_PATH);
  settings.mcpServers = settings.mcpServers || {};
  settings.mcpServers[name] = { command, args, env };

  await fs.writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2));
  res.json({ success: true });
});

// PUT /api/claude-config/mcp/:name
router.put('/mcp/:name', async (req, res) => {
  const { name } = req.params;
  const { command, args, env } = req.body;

  await backupFile(SETTINGS_PATH);
  const settings = await readJsonFile(SETTINGS_PATH);
  if (!settings.mcpServers?.[name]) {
    return res.status(404).json({ error: 'Server not found' });
  }

  settings.mcpServers[name] = { command, args, env };
  await fs.writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2));
  res.json({ success: true });
});

// DELETE /api/claude-config/mcp/:name
router.delete('/mcp/:name', async (req, res) => {
  const { name } = req.params;

  await backupFile(SETTINGS_PATH);
  const settings = await readJsonFile(SETTINGS_PATH);
  if (!settings.mcpServers?.[name]) {
    return res.status(404).json({ error: 'Server not found' });
  }

  delete settings.mcpServers[name];
  await fs.writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2));
  res.json({ success: true });
});
```

**Step 2: Commit**

```bash
git add -A && git commit -m "feat(#51): MCP 服务器 CRUD 接口"
```

---

### Task 52: CLAUDE.md 读写接口

**Files:**
- Modify: `backend/routes/claude-config.js`

**Step 1: 添加 CLAUDE.md 接口**

```javascript
// 路径校验：只允许 .md 文件
function isValidMdPath(filePath) {
  const resolved = path.resolve(filePath);
  return resolved.endsWith('.md') && !resolved.includes('..');
}

// GET /api/claude-config/claudemd
router.get('/claudemd', async (req, res) => {
  const { path: filePath } = req.query;
  if (!filePath || !isValidMdPath(filePath)) {
    return res.status(400).json({ error: 'Invalid path' });
  }

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    res.json({ path: filePath, content });
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.json({ path: filePath, content: '' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// PUT /api/claude-config/claudemd
router.put('/claudemd', async (req, res) => {
  const { path: filePath, content } = req.body;
  if (!filePath || !isValidMdPath(filePath)) {
    return res.status(400).json({ error: 'Invalid path' });
  }

  try {
    await backupFile(filePath);
    await fs.writeFile(filePath, content, 'utf-8');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

**Step 2: Commit**

```bash
git add -A && git commit -m "feat(#52): CLAUDE.md 读写接口"
```

---

### Task 53: 配置备份恢复接口

**Files:**
- Modify: `backend/routes/claude-config.js`

**Step 1: 添加备份恢复接口**

```javascript
const BACKUP_DIR = path.join(CLAUDE_DIR, 'backups');

// POST /api/claude-config/backup
router.post('/backup', async (req, res) => {
  try {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, `settings-${timestamp}.json`);

    const settings = await readJsonFile(SETTINGS_PATH);
    await fs.writeFile(backupPath, JSON.stringify(settings, null, 2));

    res.json({ success: true, backupId: timestamp });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/claude-config/backups
router.get('/backups', async (req, res) => {
  try {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
    const files = await fs.readdir(BACKUP_DIR);
    const backups = files
      .filter(f => f.startsWith('settings-') && f.endsWith('.json'))
      .map(f => ({
        id: f.replace('settings-', '').replace('.json', ''),
        filename: f
      }))
      .sort((a, b) => b.id.localeCompare(a.id));

    res.json(backups);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/claude-config/restore/:id
router.post('/restore/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const backupPath = path.join(BACKUP_DIR, `settings-${id}.json`);

    const backup = await fs.readFile(backupPath, 'utf-8');
    await backupFile(SETTINGS_PATH);
    await fs.writeFile(SETTINGS_PATH, backup);

    res.json({ success: true });
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.status(404).json({ error: 'Backup not found' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});
```

**Step 2: Commit**

```bash
git add -A && git commit -m "feat(#53): 配置备份恢复接口"
```

---

## Phase 3: 配置管理前端 (Features #54-58)

### Task 54: 新增 /config 路由

**Files:**
- Modify: `frontend/src/main.js`
- Modify: `frontend/src/App.vue`
- Create: `frontend/src/views/ConfigPage.vue`

**Step 1: 创建空的 ConfigPage.vue**

```vue
<template>
  <div class="config-page">
    <h1 class="page-title">配置管理</h1>
    <p>配置页面开发中...</p>
  </div>
</template>

<script setup>
</script>

<style scoped>
.config-page {
  padding: 20px;
}
</style>
```

**Step 2: 添加路由**

在 main.js 的 routes 数组添加：

```javascript
import ConfigPage from './views/ConfigPage.vue'

const routes = [
  { path: '/', component: Dashboard },
  { path: '/processes', component: Processes },
  { path: '/config', component: ConfigPage }
]
```

**Step 3: 在 App.vue 导航栏添加链接**

```vue
<router-link to="/config">配置</router-link>
```

**Step 4: Commit**

```bash
git add -A && git commit -m "feat(#54): 新增 /config 路由和导航入口"
```

---

### Task 55: 环境变量 Tab

**Files:**
- Modify: `frontend/src/views/ConfigPage.vue`

**Step 1: 实现环境变量表单**

包含：模型选择下拉、API 地址输入、Token 脱敏显示、保存按钮

**Step 2: Commit**

```bash
git add -A && git commit -m "feat(#55): ConfigPage 环境变量 Tab"
```

---

### Task 56: MCP 服务器 Tab

**Files:**
- Modify: `frontend/src/views/ConfigPage.vue`

**Step 1: 实现 MCP 服务器列表和表单**

**Step 2: Commit**

```bash
git add -A && git commit -m "feat(#56): ConfigPage MCP 服务器 Tab"
```

---

### Task 57: CLAUDE.md Tab + Monaco Editor

**Files:**
- Modify: `frontend/src/views/ConfigPage.vue`
- Modify: `frontend/package.json`

**Step 1: 安装 Monaco Editor**

```bash
cd frontend && npm install monaco-editor
```

**Step 2: 集成 Monaco Editor**

**Step 3: Commit**

```bash
git add -A && git commit -m "feat(#57): ConfigPage CLAUDE.md Tab 集成 Monaco Editor"
```

---

### Task 58: 未保存离开提示

**Files:**
- Modify: `frontend/src/views/ConfigPage.vue`

**Step 1: 添加 beforeRouteLeave 守卫**

**Step 2: Commit**

```bash
git add -A && git commit -m "feat(#58): 未保存离开提示"
```

---

## 完成后验证

1. `bash init.sh` 确认环境正常
2. 检查所有 18 个新功能的 passes 都为 true
3. 亮暗主题切换正常
4. 配置页面所有 Tab 功能正常
5. `git push` 推送所有更改
