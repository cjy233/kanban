# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Server monitoring application with real-time system metrics display. Despite the folder name, this is not a kanban board.

## Commands

### Backend
```bash
cd backend && npm start          # Start server on port 7777
```

### Frontend
```bash
cd frontend && npm run dev       # Development server
cd frontend && npm run build     # Build for production (outputs to frontend/dist/)
```

### Full Stack Development
Run backend and frontend separately. Backend serves the built frontend from `frontend/dist/`.

## Architecture

### Backend (`backend/server.js`)
- Express server with REST API and WebSocket
- Uses `systeminformation` package for system metrics
- Port: 7777
- API endpoints:
  - `GET /api/stats` - CPU, memory, OS info, uptime
  - `GET /api/processes` - Top 100 processes by CPU
  - `DELETE /api/processes/:pid` - Kill process
- WebSocket (`/ws`) broadcasts stats every 3 seconds

### Frontend (Vue 3 + Vite)
- Composition API with `<script setup>`
- Vue Router for navigation (no Pinia state management used)
- Chart.js for CPU/memory trend graphs
- Views:
  - `Dashboard.vue` - System overview with real-time charts
  - `Processes.vue` - Process list with search, sort, and kill functionality
- WebSocket connection with automatic polling fallback
- API helper in `src/utils/api.js`

### Data Flow
Frontend connects via WebSocket for real-time updates. If WebSocket fails, falls back to polling `/api/stats` every 3 seconds.

## UI Visual Iteration Workflow

When building or modifying frontend UI, always follow this visual verification loop:

1. **Design** - Invoke `frontend-design` skill, choose a bold aesthetic direction, avoid generic AI look
2. **Implement** - Write code with intentional typography, color, layout, and motion choices
3. **Build** - Run `cd frontend && npm run build` to produce static files
4. **Render** - Use Playwright to open the page in a headless browser
5. **Screenshot** - Capture the rendered page with `browser_take_screenshot`
6. **Analyze** - Use `understand_image` to evaluate visual quality (spacing, alignment, color harmony, typography)
7. **Compare** - If user provided a reference screenshot/URL, compare against it
8. **Iterate** - Fix issues found in analysis, repeat steps 3-7 until quality is satisfactory

This workflow ensures UI output is visually verified, not just syntactically correct.
