<template>
  <Teleport to="body">
    <Transition name="toast">
      <div v-if="visible" :class="['toast', type]">
        <span class="toast-icon">{{ icon }}</span>
        <span class="toast-message">{{ message }}</span>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  message: { type: String, default: '' },
  type: { type: String, default: 'info' },
  duration: { type: Number, default: 3000 },
  show: { type: Boolean, default: false }
})

const emit = defineEmits(['update:show'])

const visible = ref(false)
let timer = null

const icon = computed(() => {
  const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' }
  return icons[props.type] || icons.info
})

watch(() => props.show, (val) => {
  if (val) {
    visible.value = true
    clearTimeout(timer)
    timer = setTimeout(() => {
      visible.value = false
      emit('update:show', false)
    }, props.duration)
  } else {
    visible.value = false
  }
}, { immediate: true })
</script>

<style scoped>
.toast {
  position: fixed;
  top: 60px;
  left: 50%;
  transform: translateX(-50%);
  padding: 10px 20px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  z-index: 9999;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  max-width: calc(100% - 32px);
}

.toast.success {
  background: var(--color-success, #10b981);
  color: #fff;
}

.toast.error {
  background: var(--color-danger, #ef4444);
  color: #fff;
}

.toast.info {
  background: var(--color-primary, #2563eb);
  color: #fff;
}

.toast.warning {
  background: #f59e0b;
  color: #fff;
}

.toast-icon {
  font-size: 16px;
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-20px);
}
</style>
