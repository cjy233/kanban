<template>
  <div class="app-container">
    <nav class="nav">
      <div class="nav-brand">
        服务器监控
        <span :class="['status-dot', connectionStatus]" :title="statusTitle"></span>
        <span class="status-text">{{ statusTitle }}</span>
      </div>
      <div class="nav-links">
        <router-link to="/">仪表盘</router-link>
        <router-link to="/processes">进程管理</router-link>
        <button class="theme-toggle" @click="toggleTheme" :title="isDark ? '切换亮色模式' : '切换暗色模式'">
          {{ isDark ? '☀️' : '🌙' }}
        </button>
      </div>
    </nav>

    <router-view @connection-status="updateStatus" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const connectionStatus = ref('disconnected')
const isDark = ref(false)

const statusTitle = computed(() => {
  const titles = {
    connected: '已连接',
    connecting: '连接中...',
    disconnected: '已断开',
    error: '连接错误'
  }
  return titles[connectionStatus.value] || '未知状态'
})

const updateStatus = (status) => {
  connectionStatus.value = status
}

const applyTheme = (dark) => {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
}

const toggleTheme = () => {
  isDark.value = !isDark.value
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
  applyTheme(isDark.value)
}

onMounted(() => {
  const saved = localStorage.getItem('theme')
  isDark.value = saved === 'dark'
  applyTheme(isDark.value)
})
</script>

<style scoped>
.status-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  margin-left: 6px;
  vertical-align: middle;
}

.status-dot.connected {
  background: var(--color-success, #10b981);
  box-shadow: 0 0 4px var(--color-success, #10b981);
}

.status-dot.connecting {
  background: var(--color-warning, #f59e0b);
  animation: pulse 1s infinite;
}

.status-dot.disconnected,
.status-dot.error {
  background: var(--color-danger, #ef4444);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.nav-links a {
  padding: 14px 4px;
  border-bottom: 2px solid transparent;
  font-size: 14px;
}

.nav-links a.router-link-active,
.nav-links a.router-link-exact-active {
  border-bottom-color: var(--color-primary);
}

.theme-toggle {
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
  padding: 4px 8px;
  line-height: 1;
  transition: background 0.2s;
}

.theme-toggle:hover {
  background: var(--color-bg-hover);
}
</style>
