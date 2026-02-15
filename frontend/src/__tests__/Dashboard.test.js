import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

// Mock Chart.js before importing Dashboard
vi.mock('chart.js', () => {
  class ChartMock {
    constructor() {
      this.data = { labels: [], datasets: [{ data: [] }] }
    }
    update() {}
    destroy() {}
    static register() {}
  }
  return { Chart: ChartMock, registerables: [] }
})

// Mock canvas getContext
HTMLCanvasElement.prototype.getContext = () => ({
  canvas: { width: 300, height: 150 },
  clearRect() {}, fillRect() {}, getImageData() {}, putImageData() {},
  createImageData() {}, setTransform() {}, drawImage() {}, save() {},
  fillText() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {},
  closePath() {}, stroke() {}, translate() {}, scale() {}, rotate() {},
  arc() {}, fill() {}, transform() {}, rect() {}, clip() {},
  measureText: () => ({ width: 0 }),
})

import Dashboard from '../views/Dashboard.vue'

const mockStats = {
  cpu: { usage: 45.2, cores: [30.1, 50.2, 40.5, 60.8] },
  memory: { total: 16e9, used: 8e9, free: 4e9, available: 8e9, usedPercent: 62.3 },
  uptime: 180000,
  disk: [{ fs: '/dev/sda1', type: 'ext4', mount: '/', size: 5e11, used: 2.5e11, available: 2.5e11, usedPercent: 50 }],
  network: [{ iface: 'eth0', rxBytes: 1e6, txBytes: 5e5, rxSec: 1024, txSec: 512 }],
  os: { distro: 'Ubuntu 22.04', hostname: 'server1', platform: 'linux', kernel: '5.15.0' }
}

// WebSocket mock as a proper class
class MockWebSocket {
  constructor() {
    this.readyState = 0
    setTimeout(() => {
      this.readyState = 1
      if (this.onopen) this.onopen()
    }, 0)
  }
  close() {}
  addEventListener() {}
  removeEventListener() {}
}
MockWebSocket.OPEN = 1
MockWebSocket.CLOSED = 3

describe('Dashboard', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockStats)
    })
    global.WebSocket = MockWebSocket
  })

  it('renders page title', () => {
    const wrapper = mount(Dashboard)
    expect(wrapper.find('.page-title').text()).toBe('系统概览')
  })

  it('displays CPU stats after data loads', async () => {
    const wrapper = mount(Dashboard)
    await flushPromises()
    expect(wrapper.find('.stat-card--cpu .stat-value').text()).toContain('45.2')
  })

  it('displays memory stats after data loads', async () => {
    const wrapper = mount(Dashboard)
    await flushPromises()
    expect(wrapper.find('.stat-card--memory .stat-value').text()).toContain('62.3')
  })

  it('shows CPU cores section', async () => {
    const wrapper = mount(Dashboard)
    await flushPromises()
    const coreItems = wrapper.findAll('.cpu-core-item')
    expect(coreItems.length).toBe(4)
  })

  it('shows disk info section', async () => {
    const wrapper = mount(Dashboard)
    await flushPromises()
    expect(wrapper.find('.disk-section').exists()).toBe(true)
  })

  it('shows network info section', async () => {
    const wrapper = mount(Dashboard)
    await flushPromises()
    expect(wrapper.find('.network-section').exists()).toBe(true)
  })

  it('has chart range selector buttons', async () => {
    const wrapper = mount(Dashboard)
    await flushPromises()
    const btns = wrapper.findAll('.chart-range-btn')
    expect(btns.length).toBeGreaterThanOrEqual(3)
  })
})
