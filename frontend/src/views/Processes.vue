<template>
  <div class="processes-page">
    <h1 class="page-title">进程管理</h1>

    <div class="toolbar">
      <input
        v-model="search"
        type="text"
        class="search-input"
        placeholder="搜索进程名称或命令..."
      />
      <span class="process-count">共 {{ filteredProcesses.length }} 个进程</span>
      <label class="auto-refresh-toggle">
        <input type="checkbox" v-model="autoRefresh" />
        <span>自动刷新</span>
      </label>
      <button class="btn btn-primary" @click="fetchProcesses">刷新</button>
      <button class="btn btn-secondary" @click="exportCSV">导出 CSV</button>
    </div>

    <div class="process-table">
      <table>
        <thead>
          <tr>
            <th @click="sort('pid')" :class="{ 'sort-active': sortBy === 'pid' }">PID {{ sortBy === 'pid' ? (sortAsc ? '↑' : '↓') : '' }}</th>
            <th @click="sort('name')" :class="{ 'sort-active': sortBy === 'name' }">名称 {{ sortBy === 'name' ? (sortAsc ? '↑' : '↓') : '' }}</th>
            <th @click="sort('cpu')" :class="{ 'sort-active': sortBy === 'cpu' }">CPU % {{ sortBy === 'cpu' ? (sortAsc ? '↑' : '↓') : '' }}</th>
            <th @click="sort('mem')" :class="{ 'sort-active': sortBy === 'mem' }">内存 {{ sortBy === 'mem' ? (sortAsc ? '↑' : '↓') : '' }}</th>
            <th>状态</th>
            <th>用户</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="proc in filteredProcesses"
            :key="proc.pid"
            @click="showDetail(proc)"
          >
            <td class="process-pid">{{ proc.pid }}</td>
            <td class="process-name">{{ proc.name }}</td>
            <td>
              <span class="usage-bar">
                <span class="usage-fill cpu" :style="{ width: Math.min(proc.cpu, 100) + '%' }"></span>
              </span>
              {{ proc.cpu.toFixed(1) }}
            </td>
            <td>
              <span class="usage-bar">
                <span class="usage-fill memory" :style="{ width: Math.min(proc.mem, 100) + '%' }"></span>
              </span>
              {{ proc.mem.toFixed(1) }} · {{ formatBytes(proc.memRss) }}
            </td>
            <td><span class="state-badge" :class="getStateClass(proc.state)">{{ getStateLabel(proc.state) }}</span></td>
            <td>{{ proc.user }}</td>
          </tr>
          <tr v-if="!loading && !fetchError && search && filteredProcesses.length === 0">
            <td colspan="6" class="empty-state">未找到匹配的进程</td>
          </tr>
        </tbody>
      </table>

      <div v-if="fetchError && !loading" class="empty-state">
        <p>加载进程列表失败</p>
        <button class="btn btn-primary" @click="fetchProcesses">重试</button>
      </div>

      <div v-if="loading" class="loading">
        <div class="spinner"></div>
        加载中...
      </div>
    </div>

    <!-- 详情弹窗 -->
    <Transition name="modal">
    <div v-if="selectedProc" class="modal-overlay" @click.self="closeDetail" @keydown.esc="closeDetail">
      <div class="modal">
        <div class="modal-header">
          <h3 class="modal-title">进程详情</h3>
          <button class="modal-close" @click="closeDetail">&times;</button>
        </div>
        <div class="modal-body">
          <div class="detail-row">
            <span class="detail-label">PID</span>
            <span class="detail-value">{{ selectedProc.pid }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">名称</span>
            <span class="detail-value">{{ selectedProc.name }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">CPU</span>
            <span class="detail-value">{{ selectedProc.cpu.toFixed(2) }}%</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">内存</span>
            <span class="detail-value">{{ selectedProc.mem.toFixed(2) }}% · {{ formatBytes(selectedProc.memRss) }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">状态</span>
            <span class="detail-value"><span class="state-badge" :class="getStateClass(selectedProc.state)">{{ getStateLabel(selectedProc.state) }}</span></span>
          </div>
          <div class="detail-row">
            <span class="detail-label">用户</span>
            <span class="detail-value">{{ selectedProc.user }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">命令</span>
            <span class="detail-value command-text">{{ selectedProc.command }}</span>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-danger" @click="confirmKill" :disabled="killing">
            {{ killing ? '终止中...' : '终止进程' }}
          </button>
        </div>
      </div>
    </div>
    </Transition>

    <!-- 确认弹窗 -->
    <ConfirmModal
      v-model:show="showConfirm"
      title="终止进程"
      :message="`确定要终止进程 ${selectedProc?.pid} 吗？`"
      confirm-text="终止"
      :loading="killing"
      loading-text="终止中..."
      @confirm="killProcess"
      @cancel="showConfirm = false"
    />

    <!-- Toast 通知 -->
    <Toast
      v-model:show="toast.show"
      :message="toast.message"
      :type="toast.type"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import ConfirmModal from '../components/ConfirmModal.vue'
import Toast from '../components/Toast.vue'

const processes = ref([])
const loading = ref(false)
const fetchError = ref(false)
const search = ref('')
const sortBy = ref('cpu')
const sortAsc = ref(false)
const selectedProc = ref(null)
const killing = ref(false)
const showConfirm = ref(false)
const toast = ref({ show: false, message: '', type: 'info' })
const autoRefresh = ref(true)

let pollInterval = null

const filteredProcesses = computed(() => {
  let result = processes.value

  if (search.value) {
    const q = search.value.toLowerCase()
    result = result.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.pid.toString().includes(q) ||
      (p.command && p.command.toLowerCase().includes(q))
    )
  }

  result = [...result].sort((a, b) => {
    const aVal = a[sortBy.value]
    const bVal = b[sortBy.value]
    if (typeof aVal === 'string') {
      return sortAsc.value ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
    }
    return sortAsc.value ? aVal - bVal : bVal - aVal
  })

  return result
})

const formatBytes = (bytes) => {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i]
}

const stateMap = {
  R: '运行中',
  S: '睡眠',
  Z: '僵尸',
  T: '已停止',
  I: '空闲',
  D: '等待I/O'
}

const getStateLabel = (state) => stateMap[state] || state

const getStateClass = (state) => {
  if (state === 'R') return 'state--running'
  if (state === 'Z') return 'state--zombie'
  return ''
}

const showToast = (message, type = 'info') => {
  toast.value = { show: true, message, type }
}

const fetchProcesses = async () => {
  loading.value = true
  fetchError.value = false
  try {
    const res = await fetch('/api/processes')
    const data = await res.json()
    processes.value = data.list
  } catch (e) {
    console.error('Failed to fetch processes:', e)
    fetchError.value = true
  } finally {
    loading.value = false
  }
}

const sort = (field) => {
  if (sortBy.value === field) {
    sortAsc.value = !sortAsc.value
  } else {
    sortBy.value = field
    sortAsc.value = false
  }
}

const showDetail = (proc) => {
  selectedProc.value = proc
}

const closeDetail = () => {
  selectedProc.value = null
}

const exportCSV = () => {
  const rows = filteredProcesses.value
  const header = 'PID,Name,CPU,Memory,User'
  const csvRows = rows.map(p => {
    const name = p.name.includes(',') ? `"${p.name}"` : p.name
    const user = (p.user || '').includes(',') ? `"${p.user}"` : (p.user || '')
    return `${p.pid},${name},${p.cpu.toFixed(1)},${p.mem.toFixed(1)},${user}`
  })
  const csv = [header, ...csvRows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `processes-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const confirmKill = () => {
  showConfirm.value = true
}

const killProcess = async () => {
  if (!selectedProc.value) return
  const pid = selectedProc.value.pid

  killing.value = true
  try {
    const res = await fetch(`/api/processes/${pid}`, {
      method: 'DELETE'
    })
    const data = await res.json()

    if (res.ok) {
      showToast(`进程 ${pid} 已终止`, 'success')
      showConfirm.value = false
      selectedProc.value = null
      fetchProcesses()
    } else {
      showToast(data.error || '终止失败', 'error')
    }
  } catch (e) {
    showToast('请求失败', 'error')
  } finally {
    killing.value = false
  }
}

// ESC 键关闭弹窗
const handleKeydown = (e) => {
  if (e.key === 'Escape' && selectedProc.value && !showConfirm.value) {
    closeDetail()
  }
}

const startPolling = () => {
  stopPolling()
  pollInterval = setInterval(fetchProcesses, 5000)
}

const stopPolling = () => {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
}

watch(autoRefresh, (val) => {
  if (val) {
    startPolling()
  } else {
    stopPolling()
  }
})

onMounted(() => {
  fetchProcesses()
  if (autoRefresh.value) {
    startPolling()
  }
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  stopPolling()
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.sort-active {
  color: var(--color-primary);
}

.process-count {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: var(--color-text-secondary);
}

.command-text {
  font-family: monospace;
  word-break: break-all;
}

.state-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  background: var(--color-bg-subtle, #f8fafc);
  color: var(--color-text-secondary, #64748b);
}

.state--running {
  background: rgba(16, 185, 129, 0.1);
  color: var(--color-success, #10b981);
}

.state--zombie {
  background: rgba(239, 68, 68, 0.1);
  color: var(--color-danger, #ef4444);
}

.auto-refresh-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 14px;
  color: var(--color-text-secondary, #64748b);
  user-select: none;
}

.auto-refresh-toggle input[type="checkbox"] {
  cursor: pointer;
}

.modal-enter-active,
.modal-leave-active {
  transition: all 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal,
.modal-leave-to .modal {
  transform: scale(0.95);
}
</style>
