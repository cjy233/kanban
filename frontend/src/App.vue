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
      </div>
    </nav>

    <router-view @connection-status="updateStatus" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const connectionStatus = ref('disconnected')

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
</style>
