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

    <!-- MCP 服务器 Tab（占位） -->
    <div v-if="activeTab === 'mcp'" class="tab-content">
      <p class="placeholder-text">MCP 服务器配置（开发中）</p>
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
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import Toast from '../components/Toast.vue'

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
})
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
</style>
