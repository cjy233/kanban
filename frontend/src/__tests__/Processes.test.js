import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import Processes from '../views/Processes.vue'

const mockProcesses = {
  list: [
    { pid: 1, name: 'systemd', cpu: 0.5, mem: 1.2, memRss: 50000000, state: 'S', user: 'root', command: '/sbin/init' },
    { pid: 100, name: 'node', cpu: 25.3, mem: 5.4, memRss: 200000000, state: 'R', user: 'ubuntu', command: 'node server.js' },
    { pid: 200, name: 'chrome', cpu: 12.1, mem: 8.7, memRss: 400000000, state: 'S', user: 'ubuntu', command: '/usr/bin/chrome' }
  ]
}

describe('Processes', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(mockProcesses) })
    )
  })

  it('renders page title', () => {
    const wrapper = mount(Processes)
    expect(wrapper.find('.page-title').text()).toBe('进程管理')
  })

  it('loads and displays processes', async () => {
    const wrapper = mount(Processes)
    await flushPromises()
    const rows = wrapper.findAll('tbody tr')
    expect(rows.length).toBe(3)
  })

  it('shows process count', async () => {
    const wrapper = mount(Processes)
    await flushPromises()
    expect(wrapper.find('.process-count').text()).toContain('3')
  })

  it('filters processes by search', async () => {
    const wrapper = mount(Processes)
    await flushPromises()
    await wrapper.find('.search-input').setValue('node')
    const rows = wrapper.findAll('tbody tr')
    expect(rows.length).toBe(1)
    expect(rows[0].find('.process-name').text()).toBe('node')
  })

  it('sorts by column when header clicked', async () => {
    const wrapper = mount(Processes)
    await flushPromises()
    // Default sort is by cpu desc, so node (25.3) should be first
    let firstRow = wrapper.find('tbody tr .process-name')
    expect(firstRow.text()).toBe('node')

    // Click PID header to sort by PID
    await wrapper.findAll('th')[0].trigger('click')
    await wrapper.vm.$nextTick()
    firstRow = wrapper.find('tbody tr .process-pid')
    // Descending by default
    expect(firstRow.text()).toBe('200')
  })

  it('shows process detail modal on row click', async () => {
    const wrapper = mount(Processes)
    await flushPromises()
    await wrapper.find('tbody tr').trigger('click')
    expect(wrapper.find('.modal').exists()).toBe(true)
    expect(wrapper.find('.modal-title').text()).toBe('进程详情')
  })

  it('has export CSV button', async () => {
    const wrapper = mount(Processes)
    await flushPromises()
    const exportBtn = wrapper.findAll('.btn-secondary').find(b => b.text().includes('导出'))
    expect(exportBtn).toBeTruthy()
  })

  it('has auto-refresh toggle', () => {
    const wrapper = mount(Processes)
    expect(wrapper.find('.auto-refresh-toggle').exists()).toBe(true)
  })

  it('shows empty state when search has no results', async () => {
    const wrapper = mount(Processes)
    await flushPromises()
    await wrapper.find('.search-input').setValue('nonexistent_process_xyz')
    expect(wrapper.find('.empty-state').exists()).toBe(true)
  })
})
