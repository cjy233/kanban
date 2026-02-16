<template>
  <div class="config-page">
    <h1 class="page-title">配置管理</h1>

    <!-- Tab 导航 -->
    <div class="tab-nav">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :class="['tab-btn', { active: activeTab === tab.id }]"
        @click="activeTab = tab.id"
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

    <!-- CLAUDE.md Tab（占位） -->
    <div v-if="activeTab === 'claudemd'" class="tab-content">
      <p class="placeholder-text">CLAUDE.md 编辑器（开发中）</p>
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
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import Toast from '../components/Toast.vue'
import ConfirmModal from '../components/ConfirmModal.vue'

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

    showToast('配置已保存', 'success')
  } catch (err) {
    showToast('保存失败: ' + err.message, 'error')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadConfig()
  loadMcpServers()
})

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
</style>
