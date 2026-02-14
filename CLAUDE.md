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

## Long-Running Agent Protocol

This project uses a structured harness for multi-session agent work. Follow this protocol every session.

### Session Startup Checklist

Every session MUST begin with these steps, in order:

1. Run `pwd` to confirm you're in the project root
2. Read `git log --oneline -10` to see recent changes
3. Read `claude-progress.txt` for context from previous sessions
4. Read `features.json` to find the highest-priority incomplete feature (`"passes": false`)
5. Run `bash init.sh` to verify the environment is working
6. Only then begin implementation work

### Feature List Rules

`features.json` contains all tracked features with pass/fail status.

- You may ONLY change the `"passes"` field from `false` to `true`
- You may NOT remove, reorder, or edit feature descriptions
- You may ADD new features at the end of the list with the next sequential ID
- A feature can only be marked `true` after you have verified it works (build + test)
- It is unacceptable to remove or edit tests/features because this could lead to missing or buggy functionality

### Work Rules

- Work on ONE feature per session. Do not attempt multiple features.
- Pick the lowest-ID feature with `"passes": false`
- Commit after completing each feature with a descriptive message referencing the feature ID
- Update `claude-progress.txt` at the end of every session with what you did and what's next
- If you break an existing feature while working, fix it before moving on
- Run `bash init.sh` after implementation to verify nothing is broken

### Progress Tracking

`claude-progress.txt` is your handoff document between sessions. Update it with:
- What feature you worked on
- What you changed
- Any issues encountered
- What the next session should pick up
