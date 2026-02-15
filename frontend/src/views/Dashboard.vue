<template>
  <div class="dashboard">
    <h1 class="page-title">系统概览</h1>

    <template v-if="dataLoaded">
      <div class="stats-grid">
        <div class="stat-card stat-card--cpu">
          <div class="stat-header">
            <span class="stat-label">CPU 使用率</span>
          </div>
          <div class="stat-value cpu">{{ cpuUsage.toFixed(1) }}%</div>
          <div class="stat-sub">{{ systemInfo?.cpuCores || '-' }} 核心</div>
        </div>

        <div class="stat-card stat-card--memory">
          <div class="stat-header">
            <span class="stat-label">内存使用</span>
          </div>
          <div class="stat-value memory">{{ memUsage.toFixed(1) }}%</div>
          <div class="stat-sub">
            已用 {{ formatBytes(memUsed) }} / 共 {{ formatBytes(memTotal) }} · 可用 {{ formatBytes(memAvailable) }}
          </div>
        </div>

        <div class="stat-card stat-card--uptime">
          <div class="stat-header">
            <span class="stat-label">运行时间</span>
          </div>
          <div class="stat-value">{{ uptime }}</div>
          <div class="stat-sub">{{ uptimeDays }} 天</div>
        </div>
      </div>

      <!-- CPU 核心负载 -->
      <div class="cpu-cores-section" v-if="cpuCores.length">
        <h3 class="section-title">CPU 核心负载</h3>
        <div class="cpu-cores-grid">
          <div class="cpu-core-item" v-for="(load, index) in cpuCores" :key="index">
            <div class="cpu-core-label">Core {{ index }}</div>
            <div class="cpu-core-bar">
              <div class="cpu-core-fill" :style="{ width: load.toFixed(1) + '%', background: getCoreColor(load) }"></div>
            </div>
            <div class="cpu-core-value" :style="{ color: getCoreColor(load) }">{{ load.toFixed(1) }}%</div>
          </div>
        </div>
      </div>

      <div class="last-update" v-if="lastUpdateTime">
        最后更新: {{ lastUpdateAgo }}
      </div>

      <div class="charts-grid">
        <div class="chart-range-selector">
          <span class="chart-range-label">时间范围:</span>
          <button
            v-for="opt in chartRangeOptions"
            :key="opt.label"
            class="chart-range-btn"
            :class="{ active: chartRange.label === opt.label }"
            @click="setChartRange(opt)"
          >{{ opt.label }}</button>
        </div>
        <div class="chart-container">
          <h3 class="chart-title">CPU 使用率趋势</h3>
          <div class="chart-wrapper">
            <canvas ref="cpuChartRef"></canvas>
          </div>
        </div>

        <div class="chart-container">
          <h3 class="chart-title">内存使用趋势</h3>
          <div class="chart-wrapper">
            <canvas ref="memChartRef"></canvas>
          </div>
        </div>
      </div>

      <!-- 磁盘使用 -->
      <div class="disk-section" v-if="diskInfo.length">
        <h3 class="section-title">存储概览</h3>
        <div class="disk-list">
          <div class="disk-item" v-for="disk in diskInfo" :key="disk.mount">
            <div class="disk-device">{{ disk.fs }} · {{ disk.type || '未知' }}</div>
            <div class="disk-mount-point">挂载于 {{ disk.mount }}</div>
            <div class="disk-header">
              <span class="disk-bar">
                <span class="disk-fill" :style="{ width: disk.usedPercent + '%', background: getDiskColor(disk.usedPercent) }"></span>
              </span>
              <span class="disk-usage" :style="{ color: getDiskColor(disk.usedPercent) }">{{ disk.usedPercent.toFixed(1) }}%</span>
            </div>
            <div class="disk-detail">
              已用 {{ formatBytes(disk.used) }} / 共 {{ formatBytes(disk.size) }} · 剩余 {{ formatBytes(disk.available) }}
            </div>
          </div>
        </div>
      </div>

      <!-- 网络 I/O -->
      <div class="network-section" v-if="networkInfo.length">
        <h3 class="section-title">网络 I/O</h3>
        <div class="network-list">
          <div class="network-item" v-for="net in networkInfo" :key="net.iface">
            <div class="network-iface">{{ net.iface }}</div>
            <div class="network-stats">
              <span class="network-rx">↓ {{ formatSpeed(net.rxSec) }}/s</span>
              <span class="network-tx">↑ {{ formatSpeed(net.txSec) }}/s</span>
            </div>
            <div class="network-total">
              总计: ↓ {{ formatBytes(net.rxBytes) }} / ↑ {{ formatBytes(net.txBytes) }}
            </div>
          </div>
        </div>
      </div>

      <div class="system-info-section" v-if="systemInfo">
        <h3 class="section-title">系统信息</h3>
        <div class="system-info">
          <div class="info-item">
            <span class="info-label">主机名</span>
            <span class="info-value">{{ systemInfo.hostname }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">操作系统</span>
            <span class="info-value">{{ systemInfo.distro }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">平台</span>
            <span class="info-value">{{ systemInfo.platform }}</span>
          </div>
          <div class="info-item" v-if="systemInfo.kernel">
            <span class="info-label">内核</span>
            <span class="info-value">{{ systemInfo.kernel }}</span>
          </div>
        </div>
      </div>
    </template>

    <div v-else class="loading-state">
      <div class="loading-spinner"></div>
      <p>加载系统信息...</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { Chart, registerables } from 'chart.js'

Chart.register(...registerables)

const emit = defineEmits(['connection-status'])

const cpuUsage = ref(0)
const memUsage = ref(0)
const memUsed = ref(0)
const memTotal = ref(0)
const memAvailable = ref(0)
const uptime = ref('-')
const uptimeSeconds = ref(0)
const systemInfo = ref(null)
const diskInfo = ref([])
const networkInfo = ref([])
const cpuCores = ref([])
const lastUpdateTime = ref(null)
const connectionStatus = ref('disconnected')
const dataLoaded = ref(false)

const uptimeDays = computed(() => {
  if (!uptimeSeconds.value) return 0
  return Math.floor(uptimeSeconds.value / 86400)
})

const getDiskColor = (percent) => {
  if (percent > 90) return 'var(--color-danger)'
  if (percent >= 70) return 'var(--color-warning)'
  return 'var(--color-primary)'
}

const getCoreColor = (load) => {
  if (load > 90) return 'var(--color-danger, #ef4444)'
  if (load >= 70) return 'var(--color-warning, #f59e0b)'
  return 'var(--color-primary, #2563eb)'
}

// Emit connection status changes to parent
watch(connectionStatus, (status) => {
  emit('connection-status', status)
})

const cpuChartRef = ref(null)
const memChartRef = ref(null)
let cpuChart = null
let memChart = null
let ws = null
let pollInterval = null
let reconnectAttempts = 0
let reconnectTimer = null
let lastUpdateTimer = null
let themeObserver = null

const MAX_RECONNECT_ATTEMPTS = 5

const chartRangeOptions = [
  { label: '1m', seconds: 60, points: 20 },
  { label: '5m', seconds: 300, points: 100 },
  { label: '15m', seconds: 900, points: 300 }
]
const chartRange = ref(chartRangeOptions[0])
let cpuHistory = Array(chartRange.value.points).fill(0)
let memHistory = Array(chartRange.value.points).fill(0)

const setChartRange = (option) => {
  const oldLen = cpuHistory.length
  const newLen = option.points
  chartRange.value = option
  if (newLen > oldLen) {
    cpuHistory = Array(newLen - oldLen).fill(0).concat(cpuHistory)
    memHistory = Array(newLen - oldLen).fill(0).concat(memHistory)
  } else {
    cpuHistory = cpuHistory.slice(oldLen - newLen)
    memHistory = memHistory.slice(oldLen - newLen)
  }
  if (cpuChart && memChart) {
    const labels = Array(newLen).fill('')
    cpuChart.data.labels = labels
    cpuChart.data.datasets[0].data = cpuHistory
    memChart.data.labels = labels
    memChart.data.datasets[0].data = memHistory
    cpuChart.update('none')
    memChart.update('none')
  }
}

const lastUpdateAgo = computed(() => {
  if (!lastUpdateTime.value) return ''
  const seconds = Math.floor((Date.now() - lastUpdateTime.value) / 1000)
  if (seconds < 5) return '刚刚'
  if (seconds < 60) return `${seconds} 秒前`
  return `${Math.floor(seconds / 60)} 分钟前`
})

const formatBytes = (bytes) => {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i]
}

const formatSpeed = (bytesPerSec) => {
  if (!bytesPerSec || bytesPerSec < 0) return '0 B'
  return formatBytes(bytesPerSec)
}

const formatUptime = (seconds) => {
  if (!seconds) return '-'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}天 ${h}小时`
  return `${h}小时 ${m}分钟`
}

const getChartGridColor = () => {
  return getComputedStyle(document.documentElement).getPropertyValue('--color-chart-grid').trim() || '#f1f5f9'
}

const initCharts = () => {
  const gridColor = getChartGridColor()
  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 0 },
    scales: {
      y: { min: 0, max: 100, grid: { color: gridColor } },
      x: { display: false }
    },
    plugins: { legend: { display: false } }
  }

  cpuChart = new Chart(cpuChartRef.value, {
    type: 'line',
    data: {
      labels: Array(chartRange.value.points).fill(''),
      datasets: [{
        data: cpuHistory,
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 0
      }]
    },
    options: commonOptions
  })

  memChart = new Chart(memChartRef.value, {
    type: 'line',
    data: {
      labels: Array(chartRange.value.points).fill(''),
      datasets: [{
        data: memHistory,
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 0
      }]
    },
    options: commonOptions
  })
}

const updateChartTheme = () => {
  const gridColor = getChartGridColor()
  if (cpuChart) {
    cpuChart.options.scales.y.grid.color = gridColor
    cpuChart.update('none')
  }
  if (memChart) {
    memChart.options.scales.y.grid.color = gridColor
    memChart.update('none')
  }
}

const updateCharts = () => {
  if (cpuChart) {
    cpuChart.update('none')
  }
  if (memChart) {
    memChart.update('none')
  }
}

const fetchStats = async () => {
  try {
    const res = await fetch('/api/stats')
    const data = await res.json()

    cpuUsage.value = data.cpu.usage
    cpuCores.value = data.cpu.cores || []
    memUsage.value = data.memory.usedPercent
    memUsed.value = data.memory.used
    memTotal.value = data.memory.total
    memAvailable.value = data.memory.available || data.memory.free || 0
    uptimeSeconds.value = data.uptime
    uptime.value = formatUptime(data.uptime)
    systemInfo.value = data.os
    diskInfo.value = data.disk || []
    networkInfo.value = data.network || []
    lastUpdateTime.value = Date.now()
    dataLoaded.value = true

    cpuHistory.push(data.cpu.usage)
    cpuHistory.shift()
    memHistory.push(data.memory.usedPercent)
    memHistory.shift()
    updateCharts()
  } catch (e) {
    console.error('Failed to fetch stats:', e)
  }
}

const startPolling = () => {
  if (pollInterval) return
  fetchStats()
  pollInterval = setInterval(fetchStats, 3000)
}

const stopPolling = () => {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
}

const connectWebSocket = () => {
  if (ws && ws.readyState === WebSocket.OPEN) return

  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws`)
  connectionStatus.value = 'connecting'

  ws.onopen = () => {
    connectionStatus.value = 'connected'
    reconnectAttempts = 0
    stopPolling()
  }

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data)
    if (data.type === 'stats') {
      cpuUsage.value = data.cpu.usage
      cpuCores.value = data.cpu.cores || []
      memUsage.value = data.memory.usedPercent
      lastUpdateTime.value = Date.now()

      cpuHistory.push(data.cpu.usage)
      cpuHistory.shift()
      memHistory.push(data.memory.usedPercent)
      memHistory.shift()

      updateCharts()
    }
  }

  ws.onerror = () => {
    console.error('WebSocket error')
    connectionStatus.value = 'error'
  }

  ws.onclose = () => {
    connectionStatus.value = 'disconnected'
    ws = null

    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 16000)
      console.log(`WebSocket closed, reconnecting in ${delay}ms (attempt ${reconnectAttempts + 1})`)
      reconnectTimer = setTimeout(() => {
        reconnectAttempts++
        connectWebSocket()
      }, delay)
    } else {
      console.log('Max reconnect attempts reached, falling back to polling')
      startPolling()
    }
  }
}

// Expose connection status for App.vue
defineExpose({ connectionStatus })

onMounted(async () => {
  await fetchStats()
  initCharts()
  connectWebSocket()

  lastUpdateTimer = setInterval(() => {
    lastUpdateTime.value = lastUpdateTime.value
  }, 1000)

  themeObserver = new MutationObserver(() => updateChartTheme())
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
})

onUnmounted(() => {
  if (themeObserver) {
    themeObserver.disconnect()
    themeObserver = null
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  stopPolling()
  if (lastUpdateTimer) {
    clearInterval(lastUpdateTimer)
    lastUpdateTimer = null
  }
  if (ws) {
    ws.close()
    ws = null
  }
  if (cpuChart) {
    cpuChart.destroy()
    cpuChart = null
  }
  if (memChart) {
    memChart.destroy()
    memChart = null
  }
})
</script>

<style scoped>
.last-update {
  text-align: right;
  color: var(--color-text-secondary, #64748b);
  font-size: 11px;
  margin-bottom: 12px;
}

.stat-card--cpu {
  border-left: 4px solid var(--color-primary, #2563eb);
}

.stat-card--memory {
  border-left: 4px solid var(--color-success, #10b981);
}

.stat-card--uptime {
  border-left: 4px solid var(--color-border, #e2e8f0);
}

.stat-sub {
  margin-top: 6px;
  color: var(--color-text-secondary, #64748b);
  font-size: 12px;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
  color: var(--color-text-secondary, #64748b);
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border, #e2e8f0);
  border-top-color: var(--color-primary, #2563eb);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 12px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.charts-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

.system-info-section {
  background: var(--color-card, #fff);
  border-radius: 12px;
  padding: 12px;
  margin-top: 12px;
}

.system-info {
  display: grid;
  gap: 8px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  background: var(--color-bg-subtle, #f8fafc);
  border-radius: 8px;
}

.info-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary, #64748b);
}

.info-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text, #1e293b);
  font-family: monospace;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text, #1e293b);
  margin-bottom: 12px;
}

.disk-section,
.network-section {
  background: var(--color-card, #fff);
  border-radius: 12px;
  padding: 12px;
  margin-top: 12px;
}

.disk-list,
.network-list {
  display: grid;
  gap: 12px;
}

.disk-item {
  padding: 10px;
  background: var(--color-bg-subtle, #f8fafc);
  border-radius: 8px;
}

.disk-device {
  font-weight: 600;
  color: var(--color-text, #1e293b);
  font-size: 13px;
  font-family: monospace;
  word-break: break-all;
}

.disk-mount-point {
  font-size: 12px;
  color: var(--color-text-secondary, #64748b);
  margin-bottom: 8px;
}

.disk-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.disk-bar {
  flex: 1;
  height: 6px;
  background: var(--color-border, #e2e8f0);
  border-radius: 3px;
  overflow: hidden;
}

.disk-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s;
}

.disk-usage {
  font-weight: 600;
  font-size: 13px;
  white-space: nowrap;
}

.disk-detail {
  margin-top: 4px;
  font-size: 12px;
  color: var(--color-text-secondary, #64748b);
}

.network-item {
  padding: 10px;
  background: var(--color-bg-subtle, #f8fafc);
  border-radius: 8px;
}

.network-iface {
  font-weight: 500;
  font-size: 14px;
  color: var(--color-text, #1e293b);
  margin-bottom: 6px;
}

.network-stats {
  display: flex;
  gap: 16px;
  margin-bottom: 4px;
  font-size: 13px;
}

.network-rx {
  color: var(--color-success, #10b981);
  font-weight: 600;
}

.network-tx {
  color: var(--color-primary, #2563eb);
  font-weight: 600;
}

.network-total {
  font-size: 12px;
  color: var(--color-text-secondary, #64748b);
}

.cpu-cores-section {
  margin-top: 24px;
}

.cpu-cores-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

.cpu-core-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  background: var(--color-bg-subtle, #f8fafc);
  border-radius: 6px;
}

.cpu-core-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary, #64748b);
  min-width: 56px;
}

.cpu-core-bar {
  flex: 1;
  height: 8px;
  background: var(--color-bg-muted, #e2e8f0);
  border-radius: 4px;
  overflow: hidden;
}

.cpu-core-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.cpu-core-value {
  font-size: 13px;
  font-weight: 600;
  min-width: 48px;
  text-align: right;
}

.chart-range-selector {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.chart-range-label {
  font-size: 13px;
  color: var(--color-text-secondary, #64748b);
}

.chart-range-btn {
  padding: 4px 12px;
  font-size: 13px;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 6px;
  background: var(--color-bg, #fff);
  color: var(--color-text-secondary, #64748b);
  cursor: pointer;
  transition: all 0.15s ease;
}

.chart-range-btn:hover {
  border-color: var(--color-primary, #2563eb);
  color: var(--color-primary, #2563eb);
}

.chart-range-btn.active {
  background: var(--color-primary, #2563eb);
  border-color: var(--color-primary, #2563eb);
  color: #fff;
}

@media (min-width: 768px) {
  .cpu-cores-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 768px) {
  .charts-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
