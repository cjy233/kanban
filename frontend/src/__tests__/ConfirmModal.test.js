import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ConfirmModal from '../components/ConfirmModal.vue'

const stubs = { Teleport: true }

describe('ConfirmModal', () => {
  const defaultProps = {
    show: true,
    title: '确认操作',
    message: '确定要执行此操作吗？'
  }

  it('renders nothing when show is false', () => {
    const wrapper = mount(ConfirmModal, {
      props: { show: false },
      global: { stubs }
    })
    expect(wrapper.find('.confirm-overlay').exists()).toBe(false)
  })

  it('renders title and message when show is true', () => {
    const wrapper = mount(ConfirmModal, {
      props: defaultProps,
      global: { stubs }
    })
    expect(wrapper.find('.confirm-title').text()).toBe('确认操作')
    expect(wrapper.find('.confirm-body p').text()).toBe('确定要执行此操作吗？')
  })

  it('emits confirm on confirm button click', async () => {
    const wrapper = mount(ConfirmModal, {
      props: defaultProps,
      global: { stubs }
    })
    await wrapper.find('.btn-danger').trigger('click')
    expect(wrapper.emitted('confirm')).toHaveLength(1)
  })

  it('emits cancel on cancel button click', async () => {
    const wrapper = mount(ConfirmModal, {
      props: defaultProps,
      global: { stubs }
    })
    await wrapper.find('.btn-secondary').trigger('click')
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })

  it('shows loading text when loading prop is true', () => {
    const wrapper = mount(ConfirmModal, {
      props: { ...defaultProps, loading: true, loadingText: '处理中...' },
      global: { stubs }
    })
    const confirmBtn = wrapper.find('.btn-danger')
    expect(confirmBtn.text()).toBe('处理中...')
    expect(confirmBtn.attributes('disabled')).toBeDefined()
  })

  it('emits cancel when close button is clicked', async () => {
    const wrapper = mount(ConfirmModal, {
      props: defaultProps,
      global: { stubs }
    })
    await wrapper.find('.confirm-close').trigger('click')
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })
})
