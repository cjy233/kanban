<template>
  <div class="skeleton" :class="[`skeleton--${variant}`, { 'skeleton--animated': animated }]" :style="customStyle">
    <slot></slot>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  // 骨架屏类型：text, card, chart, table-row, circle
  variant: {
    type: String,
    default: 'text'
  },
  // 宽度
  width: {
    type: String,
    default: '100%'
  },
  // 高度
  height: {
    type: String,
    default: null
  },
  // 是否启用动画
  animated: {
    type: Boolean,
    default: true
  }
})

const customStyle = computed(() => {
  const style = {}
  if (props.width) style.width = props.width
  if (props.height) style.height = props.height
  return style
})
</script>

<style scoped>
/* 骨架屏基础样式 */
.skeleton {
  background: var(--skeleton-bg, linear-gradient(90deg, var(--color-border) 0%, var(--color-bg-hover) 50%, var(--color-border) 100%));
  background-size: 200% 100%;
  border-radius: 4px;
  position: relative;
  overflow: hidden;
}

/* shimmer 闪烁动画 */
.skeleton--animated {
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
}

@keyframes skeleton-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

/* 文本骨架 */
.skeleton--text {
  height: 16px;
  margin-bottom: 8px;
}

/* 卡片骨架 */
.skeleton--card {
  height: 120px;
  border-radius: 12px;
}

/* 图表骨架 */
.skeleton--chart {
  height: 200px;
  border-radius: 8px;
}

/* 表格行骨架 */
.skeleton--table-row {
  height: 48px;
  margin-bottom: 4px;
}

/* 圆形骨架（头像等） */
.skeleton--circle {
  border-radius: 50%;
}
</style>
