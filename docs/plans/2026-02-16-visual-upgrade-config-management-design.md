# 视觉升级与 Claude Code 配置管理设计文档

日期：2026-02-16

## 概述

对服务器监控应用进行全局视觉升级，并新增 Claude Code 配置管理功能。采用渐进式改造方案，保持现有 Vue 组件结构，逐步升级样式系统。

## 设计决策

| 决策项 | 选择 |
|--------|------|
| 视觉风格 | 专业仪表盘 + 简约现代结合 |
| 配色方案 | 亮/暗双主题并重 |
| 配置入口 | 独立页面（/config） |
| 配置范围 | settings.json + .claude.json + CLAUDE.md |
| 敏感信息 | 脱敏显示，点击展示 |
| CLAUDE.md 编辑 | Monaco Editor 代码编辑器 |

## 一、全局视觉升级

### 1.1 配色系统

**亮色主题**
```css
--color-bg: #fafbfc;
--color-card: #ffffff;
--color-card-shadow: 0 1px 3px rgba(0,0,0,0.08);
--color-primary: #2563eb;
--color-success: #10b981;
--color-warning: #f59e0b;
--color-danger: #ef4444;
--color-text: #1a1a2e;
--color-text-secondary: #6b7280;
--color-border: #e5e7eb;
```

**暗色主题**
```css
--color-bg: #0d1117;
--color-card: #161b22;
--color-card-shadow: 0 1px 3px rgba(0,0,0,0.3);
--color-primary: #3b82f6;
--color-success: #34d399;
--color-warning: #fbbf24;
--color-danger: #f87171;
--color-text: #e6edf3;
--color-text-secondary: #8b949e;
--color-border: #30363d;
```

### 1.2 组件升级

- **卡片**：hover 微上浮（translateY -2px），阴影加深
- **按钮**：active 按压反馈，loading 状态支持
- **表格**：行 hover 高亮，可选斑马纹
- **图表**：渐变填充，重新设计 tooltip

### 1.3 动效

- 页面切换：fade + slide（150ms）
- 数据更新：数字变化 CSS transition
- 加载状态：骨架屏 shimmer 效果

## 二、配置管理页面

### 2.1 页面结构

路由：`/config`，导航栏新增「配置」入口

三个 Tab：
1. 环境变量
2. MCP 服务器
3. CLAUDE.md

### 2.2 Tab 1：环境变量

结构化表单字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| 模型选择 | 下拉 | claude-opus-4-6 / claude-sonnet-4-5 等 |
| API 地址 | 输入框 | ANTHROPIC_BASE_URL |
| API Token | 脱敏输入 | 默认显示 sk-***...abc |
| 超时时间 | 数字 | 单位 ms |
| 其他变量 | 键值对列表 | 可增删 |

底部标注配置来源文件。

### 2.3 Tab 2：MCP 服务器

列表展示：
- 名称、命令、参数、状态
- 每行「编辑」「删除」操作
- 顶部「添加服务器」按钮

添加/编辑表单字段：
- name（服务器名称）
- command（执行命令）
- args（参数数组）
- env（环境变量键值对）

### 2.4 Tab 3：CLAUDE.md

- 文件选择器：当前项目 / 全局 / 自定义路径
- Monaco Editor：Markdown 语法高亮，主题跟随系统
- 保存：按钮 + Ctrl+S 快捷键

## 三、后端 API

### 3.1 接口列表

```
GET    /api/claude-config              # 获取合并配置
PUT    /api/claude-config/env          # 更新环境变量

GET    /api/claude-config/mcp          # MCP 服务器列表
POST   /api/claude-config/mcp          # 添加 MCP 服务器
PUT    /api/claude-config/mcp/:name    # 更新 MCP 服务器
DELETE /api/claude-config/mcp/:name    # 删除 MCP 服务器

GET    /api/claude-config/claudemd     # 读取 CLAUDE.md
PUT    /api/claude-config/claudemd     # 保存 CLAUDE.md

POST   /api/claude-config/backup       # 备份配置
GET    /api/claude-config/backups      # 备份列表
POST   /api/claude-config/restore/:id  # 恢复备份
```

### 3.2 安全措施

- CLAUDE.md 路径校验：只允许 `.md` 文件
- 写入前自动备份：创建 `.bak` 文件

## 四、数据流与错误处理

### 4.1 配置优先级

```
settings.json > .claude.json > 默认值
```

### 4.2 错误处理

| 场景 | 处理 |
|------|------|
| 配置文件不存在 | 返回空对象，显示「未配置」 |
| JSON 解析失败 | 提示格式错误，显示原始内容 |
| 文件写入失败 | Toast 提示具体原因 |
| 路径非法 | 返回 400 |

### 4.3 前端状态

- 配置数据在 ConfigPage 组件内管理
- 编辑时本地暂存，保存才提交
- 未保存离开提示确认

### 4.4 Monaco Editor

- 包：monaco-editor
- 配置：Markdown 语言、主题跟随、自动换行
- 优化：只加载 Markdown 语言包

## 五、文件变更清单

### 新增文件

```
frontend/src/views/ConfigPage.vue      # 配置管理页面
frontend/src/components/MonacoEditor.vue  # 编辑器封装
backend/routes/claude-config.js        # 配置 API 路由
```

### 修改文件

```
frontend/src/assets/style.css          # 全局样式升级
frontend/src/App.vue                   # 导航栏新增入口
frontend/src/router/index.js           # 新增 /config 路由
backend/app.js                         # 注册配置路由
frontend/src/views/Dashboard.vue       # 组件样式升级
frontend/src/views/Processes.vue       # 组件样式升级
```
