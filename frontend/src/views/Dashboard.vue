<template>
  <div class="dashboard">
    <h1 class="page-title">系统概览</h1>

    <div v-if="memAlertVisible" class="mem-alert-banner">
      <span class="mem-alert-icon">⚠</span>
      <span class="mem-alert-text">内存使用率过高: {{ memUsage.toFixed(1) }}% — 已用 {{ formatBytes(memUsed) }} / 共 {{ formatBytes(memTotal) }}</span>
      <button class="mem-alert-dismiss" @click="dismissMemAlert">✕</button>
    </div>

    <Transition name="skeleton-fade" mode="out-in">
      <div v-if="dataLoaded" key="content" class="dashboard-content">
      <div class="stats-grid">
        <div class="stat-card stat-card--cpu">
          <div class="stat-header">
            <span class="stat-label">CPU 使用率</span>
          </div>
          <div class="stat-value cpu"><AnimatedNumber :value="cpuUsage" :decimals="1" suffix="%" /></div>
          <div class="stat-sub">{{ systemInfo?.cpuCores || '-' }} 核心</div>
        </div>

        <div class="stat-card stat-card--memory">
          <div class="stat-header">
            <span class="stat-label">内存使用</span>
          </div>
          <div class="stat-value memory"><AnimatedNumber :value="memUsage" :decimals="1" suffix="%" /></div>
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
            <div class="cpu-core-value" :style="{ color: getCoreColor(load) }"><AnimatedNumber :value="load" :decimals="1" suffix="%" /></div>
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

        <div class="chart-container chart-container--network">
          <h3 class="chart-title">网络流量趋势</h3>
          <div class="chart-wrapper">
            <canvas ref="netChartRef"></canvas>
          </div>
        </div>
      </div>

      <!-- 磁盘使用 -->
      <div class="disk-section" v-if="diskInfo.length">
        <h3 class="section-title">存储概览</h3>
        <div class="disk-io-summary" v-if="diskIO.rxSec !== null">
          <span class="disk-io-label">磁盘 I/O:</span>
          <span class="disk-io-read">↓ 读取 {{ formatSpeed(diskIO.rxSec) }}/s</span>
          <span class="disk-io-write">↑ 写入 {{ formatSpeed(diskIO.wxSec) }}/s</span>
        </div>
        <div class="disk-list">
          <div class="disk-item" v-for="disk in diskInfo" :key="disk.mount">
            <div class="disk-device">{{ disk.fs }} · {{ disk.type || '未知' }}</div>
            <div class="disk-mount-point">挂载于 {{ disk.mount }}</div>
            <div class="disk-header">
              <span class="disk-bar">
                <span class="disk-fill" :style="{ width: disk.usedPercent + '%', background: getDiskColor(disk.usedPercent) }"></span>
              </span>
              <span class="disk-usage" :style="{ color: getDiskColor(disk.usedPercent) }"><AnimatedNumber :value="disk.usedPercent" :decimals="1" suffix="%" /></span>
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
      </div>

      <!-- 骨架屏加载状态 -->
      <div v-else key="skeleton" class="skeleton-container">
          <!-- 统计卡片骨架 -->
          <div class="stats-grid">
            <div class="stat-card skeleton-card" v-for="i in 3" :key="i">
              <SkeletonLoader variant="text" width="60%" height="14px" />
              <SkeletonLoader variant="text" width="40%" height="32px" style="margin-top: 12px" />
              <SkeletonLoader variant="text" width="80%" height="12px" style="margin-top: 8px" />
            </div>
          </div>

          <!-- CPU 核心骨架 -->
          <div class="cpu-cores-section skeleton-section">
            <SkeletonLoader variant="text" width="120px" height="20px" style="margin-bottom: 16px" />
            <div class="cpu-cores-grid">
              <div class="skeleton-core-item" v-for="i in 4" :key="i">
                <SkeletonLoader variant="text" width="50px" height="14px" />
                <SkeletonLoader variant="text" width="100%" height="8px" style="margin-top: 8px" />
              </div>
            </div>
          </div>

          <!-- 图表骨架 -->
          <div class="charts-grid">
            <SkeletonLoader variant="text" width="100px" height="14px" style="margin-bottom: 8px" />
            <div class="chart-container skeleton-chart" v-for="i in 2" :key="i">
              <SkeletonLoader variant="text" width="120px" height="18px" style="margin-bottom: 12px" />
              <SkeletonLoader variant="chart" height="180px" />
            </div>
          </div>

          <!-- 系统信息骨架 -->
          <div class="system-info-section skeleton-section">
            <SkeletonLoader variant="text" width="80px" height="20px" style="margin-bottom: 16px" />
            <div class="skeleton-info-grid">
              <div class="skeleton-info-item" v-for="i in 4" :key="i">
                <SkeletonLoader variant="text" width="60px" height="12px" />
                <SkeletonLoader variant="text" width="120px" height="14px" style="margin-top: 4px" />
              </div>
            </div>
          </div>
        </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { Chart, registerables } from 'chart.js'
import AnimatedNumber from '../components/AnimatedNumber.vue'
import SkeletonLoader from '../components/SkeletonLoader.vue'

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
const diskIO = ref({ rxSec: null, wxSec: null })
const networkInfo = ref([])
const cpuCores = ref([])
const lastUpdateTime = ref(null)
const connectionStatus = ref('disconnected')
const dataLoaded = ref(false)
const memAlertDismissed = ref(false)

const memAlertVisible = computed(() => {
  return memUsage.value > 90 && !memAlertDismissed.value
})

const dismissMemAlert = () => {
  memAlertDismissed.value = true
}

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

// Reset memory alert dismissed state when memory drops below threshold
watch(memUsage, (val, oldVal) => {
  if (oldVal > 90 && val <= 90) {
    memAlertDismissed.value = false
  }
})

const cpuChartRef = ref(null)
const memChartRef = ref(null)
const netChartRef = ref(null)
let cpuChart = null
let memChart = null
let netChart = null
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
let netRxHistory = Array(chartRange.value.points).fill(0)
let netTxHistory = Array(chartRange.value.points).fill(0)

const setChartRange = (option) => {
  const oldLen = cpuHistory.length
  const newLen = option.points
  chartRange.value = option
  if (newLen > oldLen) {
    cpuHistory = Array(newLen - oldLen).fill(0).concat(cpuHistory)
    memHistory = Array(newLen - oldLen).fill(0).concat(memHistory)
    netRxHistory = Array(newLen - oldLen).fill(0).concat(netRxHistory)
    netTxHistory = Array(newLen - oldLen).fill(0).concat(netTxHistory)
  } else {
    cpuHistory = cpuHistory.slice(oldLen - newLen)
    memHistory = memHistory.slice(oldLen - newLen)
    netRxHistory = netRxHistory.slice(oldLen - newLen)
    netTxHistory = netTxHistory.slice(oldLen - newLen)
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
  if (netChart) {
    const labels = Array(newLen).fill('')
    netChart.data.labels = labels
    netChart.data.datasets[0].data = netRxHistory
    netChart.data.datasets[1].data = netTxHistory
    netChart.update('none')
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

const getTotalNetSpeed = (networkData) => {
  if (!networkData || !networkData.length) return { rx: 0, tx: 0 }
  return networkData.reduce((acc, n) => {
    acc.rx += (n.rxSec || 0)
    acc.tx += (n.txSec || 0)
    return acc
  }, { rx: 0, tx: 0 })
}

// 创建垂直渐变填充
const createGradient = (ctx, colorStart, colorEnd) => {
  const gradient = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height)
  gradient.addColorStop(0, colorStart)
  gradient.addColorStop(1, colorEnd)
  return gradient
}

// 获取当前主题的图表颜色
const getChartColors = () => {
  const isDark = document.documentElement.classList.contains('dark')
  return {
    cpu: {
      border: isDark ? '#3b82f6' : '#2563eb',
      gradientStart: isDark ? 'rgba(59, 130, 246, 0.4)' : 'rgba(37, 99, 235, 0.3)',
      gradientEnd: isDark ? 'rgba(59, 130, 246, 0.02)' : 'rgba(37, 99, 235, 0.02)'
    },
    memory: {
      border: isDark ? '#34d399' : '#10b981',
      gradientStart: isDark ? 'rgba(52, 211, 153, 0.4)' : 'rgba(16, 185, 129, 0.3)',
      gradientEnd: isDark ? 'rgba(52, 211, 153, 0.02)' : 'rgba(16, 185, 129, 0.02)'
    },
    netRx: {
      border: isDark ? '#a78bfa' : '#8b5cf6',
      gradientStart: isDark ? 'rgba(167, 139, 250, 0.4)' : 'rgba(139, 92, 246, 0.3)',
      gradientEnd: isDark ? 'rgba(167, 139, 250, 0.02)' : 'rgba(139, 92, 246, 0.02)'
    },
    netTx: {
      border: isDark ? '#fbbf24' : '#f59e0b',
      gradientStart: isDark ? 'rgba(251, 191, 36, 0.4)' : 'rgba(245, 158, 11, 0.3)',
      gradientEnd: isDark ? 'rgba(251, 191, 36, 0.02)' : 'rgba(245, 158, 11, 0.02)'
    },
    tooltip: {
      bg: isDark ? 'rgba(22, 27, 34, 0.95)' : 'rgba(255, 255, 255, 0.95)',
      border: isDark ? '#30363d' : '#e5e7eb',
      text: isDark ? '#e6edf3' : '#1a1a2e',
      textSecondary: isDark ? '#8b949e' : '#6b7280'
    }
  }
}

// 自定义 tooltip 配置
const getTooltipConfig = (colors, valueFormatter = (v) => v.toFixed(1) + '%') => ({
  enabled: true,
  backgroundColor: colors.tooltip.bg,
  borderColor: colors.tooltip.border,
  borderWidth: 1,
  cornerRadius: 8,
  padding: 12,
  titleColor: colors.tooltip.textSecondary,
  titleFont: { size: 11, weight: 'normal' },
  bodyColor: colors.tooltip.text,
  bodyFont: { size: 14, weight: '600' },
  displayColors: false,
  callbacks: {
    title: () => '',
    label: (ctx) => ctx.parsed?.y != null ? valueFormatter(ctx.parsed.y) : ''
  }
})

const initCharts = () => {
  const gridColor = getChartGridColor()
  const colors = getChartColors()

  // CPU 图表渐变
  const cpuCtx = cpuChartRef.value.getContext('2d')
  const cpuGradient = createGradient(cpuCtx, colors.cpu.gradientStart, colors.cpu.gradientEnd)

  // 内存图表渐变
  const memCtx = memChartRef.value.getContext('2d')
  const memGradient = createGradient(memCtx, colors.memory.gradientStart, colors.memory.gradientEnd)

  // 网络图表渐变
  const netCtx = netChartRef.value.getContext('2d')
  const netRxGradient = createGradient(netCtx, colors.netRx.gradientStart, colors.netRx.gradientEnd)
  const netTxGradient = createGradient(netCtx, colors.netTx.gradientStart, colors.netTx.gradientEnd)

  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 0 },
    interaction: {
      intersect: false,
      mode: 'index'
    },
    scales: {
      y: { min: 0, max: 100, grid: { color: gridColor } },
      x: { display: false }
    },
    plugins: {
      legend: { display: false },
      tooltip: getTooltipConfig(colors)
    }
  }

  cpuChart = new Chart(cpuChartRef.value, {
    type: 'line',
    data: {
      labels: Array(chartRange.value.points).fill(''),
      datasets: [{
        data: cpuHistory,
        borderColor: colors.cpu.border,
        backgroundColor: cpuGradient,
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHoverBackgroundColor: colors.cpu.border,
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 2
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
        borderColor: colors.memory.border,
        backgroundColor: memGradient,
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHoverBackgroundColor: colors.memory.border,
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 2
      }]
    },
    options: commonOptions
  })

  netChart = new Chart(netChartRef.value, {
    type: 'line',
    data: {
      labels: Array(chartRange.value.points).fill(''),
      datasets: [
        {
          label: 'RX (下载)',
          data: netRxHistory,
          borderColor: colors.netRx.border,
          backgroundColor: netRxGradient,
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: colors.netRx.border,
          pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 2
        },
        {
          label: 'TX (上传)',
          data: netTxHistory,
          borderColor: colors.netTx.border,
          backgroundColor: netTxGradient,
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: colors.netTx.border,
          pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 0 },
      interaction: {
        intersect: false,
        mode: 'index'
      },
      scales: {
        y: {
          min: 0,
          grid: { color: gridColor },
          ticks: {
            callback: (v) => formatSpeed(v) + '/s'
          }
        },
        x: { display: false }
      },
      plugins: {
        legend: { display: true, position: 'top', labels: { boxWidth: 12, padding: 8 } },
        tooltip: getTooltipConfig(colors, (v) => formatSpeed(v) + '/s')
      }
    }
  })
}

const updateChartTheme = () => {
  const gridColor = getChartGridColor()
  const colors = getChartColors()

  if (cpuChart) {
    const cpuCtx = cpuChartRef.value.getContext('2d')
    const cpuGradient = createGradient(cpuCtx, colors.cpu.gradientStart, colors.cpu.gradientEnd)
    cpuChart.data.datasets[0].borderColor = colors.cpu.border
    cpuChart.data.datasets[0].backgroundColor = cpuGradient
    cpuChart.data.datasets[0].pointHoverBackgroundColor = colors.cpu.border
    cpuChart.options.scales.y.grid.color = gridColor
    cpuChart.options.plugins.tooltip = getTooltipConfig(colors)
    cpuChart.update('none')
  }
  if (memChart) {
    const memCtx = memChartRef.value.getContext('2d')
    const memGradient = createGradient(memCtx, colors.memory.gradientStart, colors.memory.gradientEnd)
    memChart.data.datasets[0].borderColor = colors.memory.border
    memChart.data.datasets[0].backgroundColor = memGradient
    memChart.data.datasets[0].pointHoverBackgroundColor = colors.memory.border
    memChart.options.scales.y.grid.color = gridColor
    memChart.options.plugins.tooltip = getTooltipConfig(colors)
    memChart.update('none')
  }
  if (netChart) {
    const netCtx = netChartRef.value.getContext('2d')
    const netRxGradient = createGradient(netCtx, colors.netRx.gradientStart, colors.netRx.gradientEnd)
    const netTxGradient = createGradient(netCtx, colors.netTx.gradientStart, colors.netTx.gradientEnd)
    netChart.data.datasets[0].borderColor = colors.netRx.border
    netChart.data.datasets[0].backgroundColor = netRxGradient
    netChart.data.datasets[0].pointHoverBackgroundColor = colors.netRx.border
    netChart.data.datasets[1].borderColor = colors.netTx.border
    netChart.data.datasets[1].backgroundColor = netTxGradient
    netChart.data.datasets[1].pointHoverBackgroundColor = colors.netTx.border
    netChart.options.scales.y.grid.color = gridColor
    netChart.options.plugins.tooltip = getTooltipConfig(colors, (v) => formatSpeed(v) + '/s')
    netChart.update('none')
  }
}

const updateCharts = () => {
  if (cpuChart) {
    cpuChart.update('none')
  }
  if (memChart) {
    memChart.update('none')
  }
  if (netChart) {
    netChart.update('none')
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
    diskIO.value = data.diskIO || { rxSec: null, wxSec: null }
    networkInfo.value = data.network || []
    lastUpdateTime.value = Date.now()
    dataLoaded.value = true

    cpuHistory.push(data.cpu.usage)
    cpuHistory.shift()
    memHistory.push(data.memory.usedPercent)
    memHistory.shift()
    const netSpeed = getTotalNetSpeed(data.network)
    netRxHistory.push(netSpeed.rx)
    netRxHistory.shift()
    netTxHistory.push(netSpeed.tx)
    netTxHistory.shift()
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
      const netSpeed = getTotalNetSpeed(data.network || [])
      netRxHistory.push(netSpeed.rx)
      netRxHistory.shift()
      netTxHistory.push(netSpeed.tx)
      netTxHistory.shift()

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
  if (netChart) {
    netChart.destroy()
    netChart = null
  }
})
</script>

<style scoped>
.mem-alert-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  margin-bottom: 16px;
  background: #fef2f2;
  border: 1px solid #fca5a5;
  border-radius: 8px;
  color: #991b1b;
  font-size: 14px;
}

[data-theme="dark"] .mem-alert-banner {
  background: #451a1a;
  border-color: #7f1d1d;
  color: #fca5a5;
}

.mem-alert-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.mem-alert-text {
  flex: 1;
  font-weight: 500;
}

.mem-alert-dismiss {
  background: none;
  border: none;
  color: inherit;
  font-size: 16px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  opacity: 0.7;
  transition: opacity 0.15s;
}

.mem-alert-dismiss:hover {
  opacity: 1;
}

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
  box-shadow: var(--color-card-shadow);
  /* 卡片 hover 过渡动画 */
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.system-info-section:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
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
  box-shadow: var(--color-card-shadow);
  /* 卡片 hover 过渡动画 */
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.disk-section:hover,
.network-section:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
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

.disk-io-summary {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 14px;
  background: var(--color-bg-subtle, #f8fafc);
  border-radius: 8px;
  margin-bottom: 10px;
  font-size: 13px;
}

.disk-io-label {
  font-weight: 500;
  color: var(--color-text, #1e293b);
}

.disk-io-read {
  color: var(--color-primary, #2563eb);
}

.disk-io-write {
  color: var(--color-warning, #f59e0b);
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

.chart-range-btn:active {
  transform: scale(0.95);
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
  .chart-container--network {
    grid-column: 1 / -1;
  }
}

/* 暗色主题下 hover 阴影更深 */
[data-theme="dark"] .system-info-section:hover,
[data-theme="dark"] .disk-section:hover,
[data-theme="dark"] .network-section:hover {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

/* 骨架屏过渡动画 */
.skeleton-fade-enter-active,
.skeleton-fade-leave-active {
  transition: opacity 0.3s ease;
}

.skeleton-fade-enter-from,
.skeleton-fade-leave-to {
  opacity: 0;
}

/* 骨架屏容器 */
.skeleton-container {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.skeleton-card {
  display: flex;
  flex-direction: column;
  padding: 20px;
}

.skeleton-section {
  padding: 20px;
}

.skeleton-core-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.skeleton-info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.skeleton-info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.skeleton-chart {
  padding: 16px;
}
</style>
