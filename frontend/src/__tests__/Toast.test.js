import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Toast from '../components/Toast.vue'

const stubs = { Teleport: true }

describe('Toast', () => {
  it('renders nothing when show is false', () => {
    const wrapper = mount(Toast, {
      props: { show: false, message: 'hello' },
      global: { stubs }
    })
    expect(wrapper.find('.toast').exists()).toBe(false)
  })

  it('renders message when show is true', () => {
    const wrapper = mount(Toast, {
      props: { show: true, message: 'Test message', type: 'success' },
      global: { stubs }
    })
    expect(wrapper.find('.toast').exists()).toBe(true)
    expect(wrapper.find('.toast-message').text()).toBe('Test message')
  })

  it('shows correct icon for each type', () => {
    const types = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' }
    for (const [type, icon] of Object.entries(types)) {
      const wrapper = mount(Toast, {
        props: { show: true, message: 'msg', type },
        global: { stubs }
      })
      expect(wrapper.find('.toast-icon').text()).toBe(icon)
    }
  })

  it('applies type class to toast element', () => {
    const wrapper = mount(Toast, {
      props: { show: true, message: 'msg', type: 'error' },
      global: { stubs }
    })
    expect(wrapper.find('.toast.error').exists()).toBe(true)
  })

  it('auto-hides after duration', async () => {
    vi.useFakeTimers()
    const wrapper = mount(Toast, {
      props: { show: true, message: 'msg', duration: 1000 },
      global: { stubs }
    })
    expect(wrapper.find('.toast').exists()).toBe(true)
    vi.advanceTimersByTime(1000)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.toast').exists()).toBe(false)
    vi.useRealTimers()
  })
})
