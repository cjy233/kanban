<template>
  <div class="config-page">
    <h1 class="page-title">配置管理</h1>

    <!-- Tab 导航 -->
    <div class="tab-nav">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :class="['tab-btn', { active: activeTab === tab.id }]"
        @click="handleTabSwitch(tab.id)"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- 环境变量 Tab -->
    <div v-if="activeTab === 'env'" class="tab-content">
      <div class="form-section">
        <!-- 模型选择 -->
        <div class="form-group">
          <label class="form-label">模型选择</label>
          <select v-model="envForm.model" class="form-select">
            <option v-for="m in modelOptions" :key="m.value" :value="m.value">
              {{ m.label }}
            </option>
          </select>
        </div>

        <!-- API 地址 -->
        <div class="form-group">
          <label class="form-label">API 地址</label>
          <input
            v-model="envForm.apiBaseUrl"
            type="text"
            class="form-input"
            placeholder="https://api.anthropic.com"
          />
        </div>

        <!-- API Token -->
        <div class="form-group">
          <label class="form-label">API Token</label>
          <div class="input-with-toggle">
            <input
              v-model="envForm.apiKey"
              :type="showApiKey ? 'text' : 'password'"
              class="form-input"
              placeholder="sk-ant-..."
            />
            <button
              type="button"
              class="toggle-btn"
              @click="showApiKey = !showApiKey"
              :title="showApiKey ? '隐藏' : '显示'"
            >
              {{ showApiKey ? '隐藏' : '显示' }}
            </button>
          </div>
          <p class="form-hint" v-if="envForm.apiKey && !showApiKey">
            {{ maskApiKey(envForm.apiKey) }}
          </p>
        </div>

        <!-- 超时时间 -->
        <div class="form-group">
          <label class="form-label">超时时间 (ms)</label>
          <input
            v-model.number="envForm.timeout"
            type="number"
            class="form-input"
            placeholder="30000"
            min="1000"
            step="1000"
          />
        </div>

        <!-- 保存按钮 -->
        <div class="form-actions">
          <button
            class="btn btn-primary"
            @click="saveEnvConfig"
            :disabled="saving"
          >
            {{ saving ? '保存中...' : '保存' }}
          </button>
        </div>

        <!-- 配置来源 -->
        <p class="config-source">
          配置来源：~/.claude/settings.json, .claude.json
        </p>
      </div>
    </div>

    <!-- MCP 服务器 Tab -->
    <div v-if="activeTab === 'mcp'" class="tab-content">
      <div class="mcp-section">
        <!-- 顶部操作栏 -->
        <div class="mcp-header">
          <span class="mcp-count">已配置 {{ mcpServers.length }} 个服务器</span>
          <button class="btn btn-primary" @click="openMcpForm()">
            添加服务器
          </button>
        </div>

        <!-- 加载状态 -->
        <div v-if="mcpLoading" class="mcp-loading">
          加载中...
        </div>

        <!-- 服务器列表 -->
        <div v-else-if="mcpServers.length > 0" class="mcp-list">
          <div
            v-for="server in mcpServers"
            :key="server.name"
            class="mcp-item"
          >
            <div class="mcp-info">
              <div class="mcp-name">
                {{ server.name }}
                <span v-if="server.source === 'project'" class="mcp-badge">项目</span>
                <span v-else class="mcp-badge mcp-badge-global">全局</span>
              </div>
              <div class="mcp-command">{{ server.command }}</div>
              <div v-if="server.args && server.args.length" class="mcp-args">
                参数: {{ server.args.join(' ') }}
              </div>
            </div>
            <div class="mcp-actions">
              <button
                class="btn-icon"
                @click="openMcpForm(server)"
                :disabled="server.source === 'project'"
                :title="server.source === 'project' ? '项目配置不可编辑' : '编辑'"
              >
                编辑
              </button>
              <button
                class="btn-icon btn-danger"
                @click="confirmDeleteMcpServer(server.name)"
                :disabled="server.source === 'project'"
                :title="server.source === 'project' ? '项目配置不可删除' : '删除'"
              >
                删除
              </button>
            </div>
          </div>
        </div>

        <!-- 空状态 -->
        <div v-else class="mcp-empty">
          <p>暂无 MCP 服务器配置</p>
          <p class="mcp-empty-hint">点击「添加服务器」开始配置</p>
        </div>

        <!-- 配置来源 -->
        <p class="config-source">
          配置来源：~/.claude/settings.json（全局）, .claude.json（项目，只读）
        </p>
      </div>

      <!-- MCP 表单弹窗 -->
      <div v-if="mcpFormVisible" class="modal-overlay" @click.self="closeMcpForm">
        <div class="modal-content">
          <h3 class="modal-title">{{ mcpForm.isEdit ? '编辑服务器' : '添加服务器' }}</h3>

          <div class="form-group">
            <label class="form-label">服务器名称 *</label>
            <input
              v-model="mcpForm.name"
              type="text"
              class="form-input"
              placeholder="例如: my-mcp-server"
              :disabled="mcpForm.isEdit"
            />
          </div>

          <div class="form-group">
            <label class="form-label">执行命令 *</label>
            <input
              v-model="mcpForm.command"
              type="text"
              class="form-input"
              placeholder="例如: npx, node, python"
            />
          </div>

          <div class="form-group">
            <label class="form-label">参数 (每行一个)</label>
            <textarea
              v-model="mcpForm.argsText"
              class="form-textarea"
              placeholder="例如:&#10;-y&#10;@anthropic/mcp-server"
              rows="3"
            ></textarea>
          </div>

          <div class="form-group">
            <label class="form-label">环境变量 (每行 KEY=VALUE)</label>
            <textarea
              v-model="mcpForm.envText"
              class="form-textarea"
              placeholder="例如:&#10;API_KEY=xxx&#10;DEBUG=true"
              rows="3"
            ></textarea>
          </div>

          <div class="modal-actions">
            <button class="btn" @click="closeMcpForm">取消</button>
            <button
              class="btn btn-primary"
              @click="saveMcpServer"
              :disabled="mcpSaving || !mcpForm.name || !mcpForm.command"
            >
              {{ mcpSaving ? '保存中...' : '保存' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- CLAUDE.md Tab -->
    <div v-if="activeTab === 'claudemd'" class="tab-content claudemd-tab">
      <!-- 文件选择器 -->
      <div class="form-group">
        <label class="form-label">文件路径</label>
        <div class="path-selector">
          <select v-model="claudemdPathType" class="form-select path-type-select">
            <option value="project">当前项目 (./CLAUDE.md)</option>
            <option value="global">全局 (~/.claude/CLAUDE.md)</option>
            <option value="custom">自定义路径</option>
          </select>
          <input
            v-if="claudemdPathType === 'custom'"
            v-model="claudemdCustomPath"
            type="text"
            class="form-input custom-path-input"
            placeholder="输入 .md 文件路径"
            @blur="loadClaudeMd"
            @keyup.enter="loadClaudeMd"
          />
        </div>
      </div>

      <!-- 编辑器区域 -->
      <div class="editor-wrapper" :class="{ loading: claudemdLoading }">
        <div v-if="claudemdLoading" class="editor-loading">
          <span>加载中...</span>
        </div>
        <MonacoEditor
          v-else
          v-model="claudemdContent"
          language="markdown"
          :theme="editorTheme"
          @save="saveClaudeMd"
        />
      </div>

      <!-- 状态栏 -->
      <div class="editor-status">
        <span v-if="!claudemdExists" class="status-hint">文件不存在，保存后将创建</span>
        <span v-else class="status-hint">{{ claudemdResolvedPath }}</span>
        <div class="editor-actions">
          <span v-if="claudemdDirty" class="dirty-indicator">● 未保存</span>
          <button
            class="btn btn-primary"
            @click="saveClaudeMd"
            :disabled="claudemdSaving"
          >
            {{ claudemdSaving ? '保存中...' : '保存 (Ctrl+S)' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Toast 通知 -->
    <Toast
      :message="toast.message"
      :type="toast.type"
      :show="toast.show"
      @update:show="toast.show = $event"
    />

    <!-- MCP 删除确认弹窗 -->
    <ConfirmModal
      v-model:show="showMcpDeleteConfirm"
      title="删除服务器"
      :message="`确定要删除服务器「${mcpDeleteTarget}」吗？`"
      confirm-text="删除"
      :loading="mcpDeleting"
      loading-text="删除中..."
      @confirm="deleteMcpServer"
      @cancel="showMcpDeleteConfirm = false"
    />

    <!-- CLAUDE.md 切换确认弹窗 -->
    <ConfirmModal
      v-model:show="showClaudemdSwitchConfirm"
      title="未保存的更改"
      message="当前文件有未保存的更改，切换后将丢失。确定要切换吗？"
      confirm-text="切换"
      @confirm="confirmSwitchClaudeMd"
      @cancel="cancelSwitchClaudeMd"
    />

    <!-- Tab 切换确认弹窗 -->
    <ConfirmModal
      v-model:show="showTabSwitchConfirm"
      title="未保存的更改"
      message="当前配置有未保存的更改，切换后将丢失。确定要切换吗？"
      confirm-text="切换"
      confirm-class="btn-warning"
      @confirm="confirmTabSwitch"
      @cancel="cancelTabSwitch"
    />

    <!-- 离开页面确认弹窗 -->
    <ConfirmModal
      v-model:show="showLeaveConfirm"
      title="未保存的更改"
      message="当前页面有未保存的更改，离开后将丢失。确定要离开吗？"
      confirm-text="离开"
      confirm-class="btn-warning"
      @confirm="confirmLeave"
      @cancel="cancelLeave"
    />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onBeforeUnmount, computed, watch } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import Toast from '../components/Toast.vue'
import ConfirmModal from '../components/ConfirmModal.vue'
import MonacoEditor from '../components/MonacoEditor.vue'

// Tab 配置
const tabs = [
  { id: 'env', label: '环境变量' },
  { id: 'mcp', label: 'MCP 服务器' },
  { id: 'claudemd', label: 'CLAUDE.md' }
]
const activeTab = ref('env')

// 模型选项
const modelOptions = [
  { value: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
  { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5' },
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
  { value: 'claude-opus-4-5-20251101', label: 'Claude Opus 4.5' }
]

// 环境变量表单
const envForm = reactive({
  model: 'claude-sonnet-4-5-20250929',
  apiBaseUrl: '',
  apiKey: '',
  timeout: 30000
})

// 环境变量原始值（用于检测未保存更改）
const envFormOriginal = reactive({
  model: 'claude-sonnet-4-5-20250929',
  apiBaseUrl: '',
  apiKey: '',
  timeout: 30000
})

// 状态
const showApiKey = ref(false)
const saving = ref(false)
const toast = reactive({
  show: false,
  message: '',
  type: 'info'
})

// MCP 服务器状态
const mcpServers = ref([])
const mcpLoading = ref(false)
const mcpFormVisible = ref(false)
const mcpSaving = ref(false)
const mcpDeleting = ref(false)
const mcpDeleteTarget = ref(null)
const showMcpDeleteConfirm = ref(false)
const mcpForm = reactive({
  isEdit: false,
  originalName: '',
  name: '',
  command: '',
  argsText: '',
  envText: ''
})

// CLAUDE.md 状态
const claudemdPathType = ref('project')
const claudemdCustomPath = ref('')
const claudemdContent = ref('')
const claudemdOriginalContent = ref('')
const claudemdLoading = ref(false)
const claudemdSaving = ref(false)
const claudemdExists = ref(false)
const claudemdResolvedPath = ref('')

// 主题状态（响应式）
const currentTheme = ref(document.documentElement.getAttribute('data-theme') || 'light')

// 计算编辑器主题（跟随系统）
const editorTheme = computed(() => {
  return currentTheme.value === 'dark' ? 'vs-dark' : 'vs'
})

// 计算是否有未保存的更改
const claudemdDirty = computed(() => {
  return claudemdContent.value !== claudemdOriginalContent.value
})

// 计算环境变量是否有未保存的更改
const envDirty = computed(() => {
  return envForm.model !== envFormOriginal.model ||
    envForm.apiBaseUrl !== envFormOriginal.apiBaseUrl ||
    envForm.apiKey !== envFormOriginal.apiKey ||
    envForm.timeout !== envFormOriginal.timeout
})

// 计算任意 Tab 是否有未保存的更改
const hasUnsavedChanges = computed(() => {
  return envDirty.value || claudemdDirty.value
})

// 获取当前选择的路径
function getClaudeMdPath() {
  switch (claudemdPathType.value) {
    case 'project':
      return './CLAUDE.md'
    case 'global':
      return '~/.claude/CLAUDE.md'
    case 'custom':
      return claudemdCustomPath.value
    default:
      return './CLAUDE.md'
  }
}

// 切换确认弹窗状态
const showClaudemdSwitchConfirm = ref(false)
const previousPathType = ref('project')
let skipNextWatch = false

// Tab 切换确认弹窗状态
const showTabSwitchConfirm = ref(false)
const pendingTab = ref(null)

// 离开页面确认弹窗状态
const showLeaveConfirm = ref(false)
let pendingNavigation = null

// 监听路径类型变化
watch(claudemdPathType, (newValue, oldValue) => {
  if (skipNextWatch) {
    skipNextWatch = false
    return
  }
  if (claudemdDirty.value) {
    // 有未保存更改，显示确认弹窗
    previousPathType.value = oldValue
    showClaudemdSwitchConfirm.value = true
  } else if (newValue !== 'custom') {
    loadClaudeMd()
  }
})

// 确认切换
function confirmSwitchClaudeMd() {
  showClaudemdSwitchConfirm.value = false
  if (claudemdPathType.value !== 'custom') {
    loadClaudeMd()
  }
}

// 取消切换
function cancelSwitchClaudeMd() {
  // 恢复之前的路径类型
  skipNextWatch = true
  claudemdPathType.value = previousPathType.value
  showClaudemdSwitchConfirm.value = false
}

// 处理 Tab 切换
function handleTabSwitch(tabId) {
  if (tabId === activeTab.value) return

  // 检查当前 Tab 是否有未保存更改
  const currentTabDirty =
    (activeTab.value === 'env' && envDirty.value) ||
    (activeTab.value === 'claudemd' && claudemdDirty.value)

  if (currentTabDirty) {
    pendingTab.value = tabId
    showTabSwitchConfirm.value = true
  } else {
    activeTab.value = tabId
  }
}

// 确认切换 Tab
function confirmTabSwitch() {
  showTabSwitchConfirm.value = false
  if (pendingTab.value) {
    // 丢弃当前 Tab 的更改
    if (activeTab.value === 'env') {
      // 恢复环境变量原始值
      envForm.model = envFormOriginal.model
      envForm.apiBaseUrl = envFormOriginal.apiBaseUrl
      envForm.apiKey = envFormOriginal.apiKey
      envForm.timeout = envFormOriginal.timeout
    } else if (activeTab.value === 'claudemd') {
      // 恢复 CLAUDE.md 原始内容
      claudemdContent.value = claudemdOriginalContent.value
    }
    activeTab.value = pendingTab.value
    pendingTab.value = null
  }
}

// 取消切换 Tab
function cancelTabSwitch() {
  showTabSwitchConfirm.value = false
  pendingTab.value = null
}

// 加载 CLAUDE.md 文件
async function loadClaudeMd() {
  const filePath = getClaudeMdPath()
  if (!filePath) return

  claudemdLoading.value = true
  try {
    const res = await fetch(`/api/claude-config/claudemd?path=${encodeURIComponent(filePath)}`)
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || '加载失败')
    }
    const data = await res.json()
    claudemdContent.value = data.content || ''
    claudemdOriginalContent.value = data.content || ''
    claudemdExists.value = data.exists
    claudemdResolvedPath.value = data.path || ''
  } catch (err) {
    showToast('加载 CLAUDE.md 失败: ' + err.message, 'error')
    claudemdContent.value = ''
    claudemdOriginalContent.value = ''
    claudemdExists.value = false
  } finally {
    claudemdLoading.value = false
  }
}

// 保存 CLAUDE.md 文件
async function saveClaudeMd() {
  const filePath = getClaudeMdPath()
  if (!filePath) {
    showToast('请输入文件路径', 'error')
    return
  }

  claudemdSaving.value = true
  try {
    const res = await fetch('/api/claude-config/claudemd', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: filePath,
        content: claudemdContent.value
      })
    })

    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || '保存失败')
    }

    claudemdOriginalContent.value = claudemdContent.value
    claudemdExists.value = true
    showToast('CLAUDE.md 已保存', 'success')
  } catch (err) {
    showToast('保存失败: ' + err.message, 'error')
  } finally {
    claudemdSaving.value = false
  }
}

// 显示 Toast 通知
function showToast(message, type = 'info') {
  toast.message = message
  toast.type = type
  toast.show = true
}

// API Token 脱敏显示
function maskApiKey(key) {
  if (!key || key.length < 8) return '***'
  const prefix = key.slice(0, 6)
  const suffix = key.slice(-3)
  return `${prefix}***...${suffix}`
}

// 加载配置
async function loadConfig() {
  try {
    const res = await fetch('/api/claude-config')
    if (!res.ok) throw new Error('加载配置失败')
    const data = await res.json()

    // 填充表单
    if (data.env) {
      envForm.model = data.env.ANTHROPIC_MODEL || envForm.model
      envForm.apiBaseUrl = data.env.ANTHROPIC_BASE_URL || ''
      envForm.apiKey = data.env.ANTHROPIC_API_KEY || ''
      envForm.timeout = data.env.ANTHROPIC_TIMEOUT || 30000

      // 保存原始值
      envFormOriginal.model = envForm.model
      envFormOriginal.apiBaseUrl = envForm.apiBaseUrl
      envFormOriginal.apiKey = envForm.apiKey
      envFormOriginal.timeout = envForm.timeout
    }
  } catch (err) {
    console.error('加载配置失败:', err)
    showToast('加载配置失败: ' + err.message, 'error')
  }
}

// 保存环境变量配置
async function saveEnvConfig() {
  saving.value = true
  try {
    const envData = {
      ANTHROPIC_MODEL: envForm.model,
      ANTHROPIC_BASE_URL: envForm.apiBaseUrl,
      ANTHROPIC_API_KEY: envForm.apiKey,
      ANTHROPIC_TIMEOUT: envForm.timeout
    }

    const res = await fetch('/api/claude-config/env', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ env: envData })
    })

    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || '保存失败')
    }

    // 更新原始值
    envFormOriginal.model = envForm.model
    envFormOriginal.apiBaseUrl = envForm.apiBaseUrl
    envFormOriginal.apiKey = envForm.apiKey
    envFormOriginal.timeout = envForm.timeout

    showToast('配置已保存', 'success')
  } catch (err) {
    showToast('保存失败: ' + err.message, 'error')
  } finally {
    saving.value = false
  }
}

// 主题变化监听器
let themeObserver = null

onMounted(() => {
  loadConfig()
  loadMcpServers()
  loadClaudeMd()

  // 监听主题变化
  themeObserver = new MutationObserver(() => {
    currentTheme.value = document.documentElement.getAttribute('data-theme') || 'light'
  })
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  })

  // 监听浏览器关闭/刷新事件
  window.addEventListener('beforeunload', handleBeforeUnload)
})

onBeforeUnmount(() => {
  if (themeObserver) {
    themeObserver.disconnect()
    themeObserver = null
  }
  window.removeEventListener('beforeunload', handleBeforeUnload)
})

// 浏览器关闭/刷新前的提示
function handleBeforeUnload(e) {
  if (hasUnsavedChanges.value) {
    e.preventDefault()
    e.returnValue = ''
    return ''
  }
}

// Vue Router 离开页面前的确认
onBeforeRouteLeave((to, from, next) => {
  if (hasUnsavedChanges.value) {
    pendingNavigation = next
    showLeaveConfirm.value = true
  } else {
    next()
  }
})

// 确认离开页面
function confirmLeave() {
  showLeaveConfirm.value = false
  if (pendingNavigation) {
    pendingNavigation()
    pendingNavigation = null
  }
}

// 取消离开页面
function cancelLeave() {
  showLeaveConfirm.value = false
  pendingNavigation = null
}

// 加载 MCP 服务器列表
async function loadMcpServers() {
  mcpLoading.value = true
  try {
    const res = await fetch('/api/claude-config/mcp')
    if (!res.ok) throw new Error('加载 MCP 配置失败')
    const data = await res.json()
    mcpServers.value = data.servers || []
  } catch (err) {
    console.error('加载 MCP 配置失败:', err)
    showToast('加载 MCP 配置失败: ' + err.message, 'error')
  } finally {
    mcpLoading.value = false
  }
}

// 打开 MCP 表单
function openMcpForm(server = null) {
  if (server) {
    // 编辑模式
    mcpForm.isEdit = true
    mcpForm.originalName = server.name
    mcpForm.name = server.name
    mcpForm.command = server.command || ''
    mcpForm.argsText = (server.args || []).join('\n')
    mcpForm.envText = Object.entries(server.env || {})
      .map(([k, v]) => `${k}=${v}`)
      .join('\n')
  } else {
    // 添加模式
    mcpForm.isEdit = false
    mcpForm.originalName = ''
    mcpForm.name = ''
    mcpForm.command = ''
    mcpForm.argsText = ''
    mcpForm.envText = ''
  }
  mcpFormVisible.value = true
}

// 关闭 MCP 表单
function closeMcpForm() {
  mcpFormVisible.value = false
}

// 保存 MCP 服务器
async function saveMcpServer() {
  mcpSaving.value = true
  try {
    // 解析参数和环境变量
    const args = mcpForm.argsText
      .split('\n')
      .map(s => s.trim())
      .filter(s => s)

    const env = {}
    mcpForm.envText
      .split('\n')
      .map(s => s.trim())
      .filter(s => s)
      .forEach(line => {
        const idx = line.indexOf('=')
        if (idx > 0) {
          env[line.slice(0, idx)] = line.slice(idx + 1)
        }
      })

    const payload = {
      name: mcpForm.name,
      command: mcpForm.command,
      args: args.length > 0 ? args : undefined,
      env: Object.keys(env).length > 0 ? env : undefined
    }

    let res
    if (mcpForm.isEdit) {
      res = await fetch(`/api/claude-config/mcp/${encodeURIComponent(mcpForm.originalName)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
    } else {
      res = await fetch('/api/claude-config/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
    }

    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || '保存失败')
    }

    showToast(mcpForm.isEdit ? '服务器已更新' : '服务器已添加', 'success')
    closeMcpForm()
    await loadMcpServers()
  } catch (err) {
    showToast('保存失败: ' + err.message, 'error')
  } finally {
    mcpSaving.value = false
  }
}

// 删除 MCP 服务器 - 打开确认弹窗
function confirmDeleteMcpServer(name) {
  mcpDeleteTarget.value = name
  showMcpDeleteConfirm.value = true
}

// 删除 MCP 服务器 - 执行删除
async function deleteMcpServer() {
  const name = mcpDeleteTarget.value
  if (!name) return

  mcpDeleting.value = true
  try {
    const res = await fetch(`/api/claude-config/mcp/${encodeURIComponent(name)}`, {
      method: 'DELETE'
    })

    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || '删除失败')
    }

    showToast(`服务器 "${name}" 已删除`, 'success')
    showMcpDeleteConfirm.value = false
    await loadMcpServers()
  } catch (err) {
    showToast('删除失败: ' + err.message, 'error')
  } finally {
    mcpDeleting.value = false
  }
}
</script>

<style scoped>
.config-page {
  padding: 24px;
  max-width: 800px;
  margin: 0 auto;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  margin: 0 0 20px 0;
  color: var(--color-text);
}

/* Tab 导航 */
.tab-nav {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--color-border);
  margin-bottom: 24px;
}

.tab-btn {
  padding: 10px 20px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--color-text-secondary);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn:hover {
  color: var(--color-text);
  background: var(--color-bg-hover);
}

.tab-btn.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}

/* Tab 内容 */
.tab-content {
  background: var(--color-card);
  border-radius: 8px;
  padding: 24px;
  box-shadow: var(--color-card-shadow);
}

/* 表单样式 */
.form-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text);
}

.form-input,
.form-select {
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 14px;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.form-input:focus,
.form-select:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.form-input::placeholder {
  color: var(--color-text-secondary);
}

/* 带切换按钮的输入框 */
.input-with-toggle {
  display: flex;
  gap: 8px;
}

.input-with-toggle .form-input {
  flex: 1;
}

.toggle-btn {
  padding: 10px 16px;
  background: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.toggle-btn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text);
}

.form-hint {
  font-size: 12px;
  color: var(--color-text-secondary);
  font-family: monospace;
}

/* 按钮 */
.form-actions {
  padding-top: 8px;
}

.btn {
  padding: 10px 24px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-dark);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 配置来源提示 */
.config-source {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 8px;
}

/* 占位文本 */
.placeholder-text {
  color: var(--color-text-secondary);
  text-align: center;
  padding: 40px;
}

/* MCP 服务器样式 */
.mcp-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.mcp-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.mcp-count {
  font-size: 14px;
  color: var(--color-text-secondary);
}

.mcp-loading {
  text-align: center;
  padding: 40px;
  color: var(--color-text-secondary);
}

.mcp-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mcp-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 16px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  transition: border-color 0.2s;
}

.mcp-item:hover {
  border-color: var(--color-primary);
}

.mcp-info {
  flex: 1;
  min-width: 0;
}

.mcp-name {
  font-weight: 600;
  color: var(--color-text);
  display: flex;
  align-items: center;
  gap: 8px;
}

.mcp-badge {
  font-size: 11px;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--color-primary);
  color: white;
}

.mcp-badge-global {
  background: var(--color-text-secondary);
}

.mcp-command {
  font-size: 13px;
  color: var(--color-text-secondary);
  font-family: monospace;
  margin-top: 4px;
}

.mcp-args {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 4px;
}

.mcp-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.btn-icon {
  padding: 6px 12px;
  background: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-icon:hover:not(:disabled) {
  background: var(--color-bg-hover);
  color: var(--color-text);
}

.btn-icon:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-icon.btn-danger:hover:not(:disabled) {
  background: var(--color-danger);
  border-color: var(--color-danger);
  color: white;
}

.mcp-empty {
  text-align: center;
  padding: 40px;
  color: var(--color-text-secondary);
}

.mcp-empty-hint {
  font-size: 13px;
  margin-top: 8px;
}

/* 弹窗样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--color-card);
  border-radius: 12px;
  padding: 24px;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
}

.modal-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 20px 0;
  color: var(--color-text);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
}

.form-textarea {
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 14px;
  font-family: monospace;
  resize: vertical;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.form-textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.form-textarea::placeholder {
  color: var(--color-text-secondary);
}

/* CLAUDE.md Tab 样式 */
.claudemd-tab {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.path-selector {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.path-type-select {
  min-width: 200px;
}

.custom-path-input {
  flex: 1;
  min-width: 200px;
}

.editor-wrapper {
  position: relative;
  height: 450px;
  border-radius: 6px;
  overflow: hidden;
}

.editor-wrapper.loading {
  background: var(--color-bg-subtle);
}

.editor-loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  font-size: 14px;
}

.editor-status {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 8px;
  border-top: 1px solid var(--color-border);
}

.status-hint {
  font-size: 12px;
  color: var(--color-text-secondary);
  font-family: monospace;
}

.editor-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.dirty-indicator {
  color: var(--color-warning);
  font-size: 13px;
  font-weight: 500;
}
</style>
