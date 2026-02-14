<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="confirm-overlay" @click.self="handleCancel" @keydown.esc="handleCancel">
        <div class="confirm-modal" ref="modalRef">
          <div class="confirm-header">
            <h3 class="confirm-title">{{ title }}</h3>
            <button class="confirm-close" @click="handleCancel" :disabled="loading">&times;</button>
          </div>
          <div class="confirm-body">
            <p>{{ message }}</p>
          </div>
          <div class="confirm-footer">
            <button class="btn btn-secondary" @click="handleCancel" :disabled="loading">{{ cancelText }}</button>
            <button :class="['btn', confirmClass]" @click="handleConfirm" :disabled="loading">
              {{ loading ? loadingText : confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  title: { type: String, default: '确认操作' },
  message: { type: String, default: '确定要执行此操作吗？' },
  confirmText: { type: String, default: '确定' },
  cancelText: { type: String, default: '取消' },
  confirmClass: { type: String, default: 'btn-danger' },
  loading: { type: Boolean, default: false },
  loadingText: { type: String, default: '处理中...' }
})

const emit = defineEmits(['confirm', 'cancel', 'update:show'])
const modalRef = ref(null)

const handleConfirm = () => {
  emit('confirm')
}

const handleCancel = () => {
  emit('cancel')
  emit('update:show', false)
}

const handleKeydown = (e) => {
  if (e.key === 'Escape' && props.show) {
    handleCancel()
  }
}

watch(() => props.show, (val) => {
  if (val) {
    document.addEventListener('keydown', handleKeydown)
  } else {
    document.removeEventListener('keydown', handleKeydown)
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9998;
}

.confirm-modal {
  background: var(--color-card, #fff);
  border-radius: 12px;
  width: 100%;
  max-width: 400px;
  margin: 16px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.confirm-header {
  padding: 16px 16px 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.confirm-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text, #1e293b);
}

.confirm-body {
  padding: 12px 16px;
  color: var(--color-text-secondary, #64748b);
  font-size: 14px;
}

.confirm-body p {
  margin: 0;
}

.confirm-footer {
  padding: 12px 16px 16px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.btn-secondary {
  background: #e2e8f0;
  color: #475569;
}

.btn-secondary:hover {
  background: #cbd5e1;
}

.confirm-close {
  background: none;
  border: none;
  font-size: 22px;
  cursor: pointer;
  color: var(--color-text-secondary, #64748b);
  line-height: 1;
  padding: 0;
}

.confirm-close:hover {
  color: var(--color-text, #1e293b);
}

.modal-enter-active,
.modal-leave-active {
  transition: all 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .confirm-modal,
.modal-leave-to .confirm-modal {
  transform: scale(0.95);
}
</style>
