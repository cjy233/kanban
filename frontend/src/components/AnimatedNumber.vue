<template>
  <span class="animated-number" :class="{ 'animated-number--transitioning': isTransitioning }">
    {{ displayValue }}
  </span>
</template>

<script setup>
import { ref, watch, onUnmounted } from 'vue'

const props = defineProps({
  // 目标数值
  value: {
    type: Number,
    required: true
  },
  // 小数位数
  decimals: {
    type: Number,
    default: 1
  },
  // 动画时长（毫秒）
  duration: {
    type: Number,
    default: 300
  },
  // 后缀（如 %）
  suffix: {
    type: String,
    default: ''
  }
})

const displayValue = ref(formatNumber(props.value))
const isTransitioning = ref(false)
let animationId = null
let startTime = null
let startValue = props.value
let endValue = props.value

// 格式化数字
function formatNumber(num) {
  if (typeof num !== 'number' || isNaN(num)) return '--' + props.suffix
  return num.toFixed(props.decimals) + props.suffix
}

// 缓动函数：ease-out
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3)
}

// 动画帧
function animate(timestamp) {
  if (!startTime) startTime = timestamp
  const elapsed = timestamp - startTime
  const progress = Math.min(elapsed / props.duration, 1)
  const easedProgress = easeOutCubic(progress)

  const currentValue = startValue + (endValue - startValue) * easedProgress
  displayValue.value = formatNumber(currentValue)

  if (progress < 1) {
    animationId = requestAnimationFrame(animate)
  } else {
    isTransitioning.value = false
    animationId = null
    startTime = null
  }
}

// 监听值变化
watch(() => props.value, (newVal, oldVal) => {
  // 取消正在进行的动画
  if (animationId) {
    cancelAnimationFrame(animationId)
  }

  // 设置起止值
  startValue = oldVal
  endValue = newVal
  startTime = null
  isTransitioning.value = true

  // 开始动画
  animationId = requestAnimationFrame(animate)
})

// 清理
onUnmounted(() => {
  if (animationId) {
    cancelAnimationFrame(animationId)
  }
})
</script>

<style scoped>
.animated-number {
  /* 使用 tabular-nums 确保数字等宽，避免布局抖动 */
  font-variant-numeric: tabular-nums;
  /* 平滑的颜色过渡 */
  transition: color 0.15s ease;
}

.animated-number--transitioning {
  /* 过渡中可添加视觉提示（可选） */
}
</style>
