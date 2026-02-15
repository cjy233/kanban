import express from 'express';
import cors from 'cors';
import si from 'systeminformation';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Get system stats
app.get('/api/stats', async (req, res) => {
  try {
    const [cpu, mem, osInfo, time, disk, network, diskIO] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.osInfo(),
      si.time(),
      si.fsSize(),
      si.networkStats(),
      si.fsStats()
    ]);
    res.json({
      cpu: { usage: cpu.currentLoad, cores: cpu.cpus.map(c => c.load) },
      memory: {
        total: mem.total,
        used: mem.used,
        free: mem.free,
        available: mem.available,
        usedPercent: ((mem.total - mem.available) / mem.total) * 100
      },
      disk: disk
        .filter(d => d.size > 0 && !d.mount.startsWith('/snap'))
        .map(d => ({
          fs: d.fs,
          type: d.type,
          mount: d.mount,
          size: d.size,
          used: d.used,
          available: d.available,
          usedPercent: d.use
        })),
      network: network.map(n => ({
        iface: n.iface,
        rxBytes: n.rx_bytes,
        txBytes: n.tx_bytes,
        rxSec: n.rx_sec,
        txSec: n.tx_sec
      })),
      diskIO: {
        rxSec: diskIO.rx_sec,
        wxSec: diskIO.wx_sec
      },
      os: { platform: osInfo.platform, distro: osInfo.distro, hostname: osInfo.hostname, kernel: osInfo.kernel },
      uptime: time.uptime
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get processes
app.get('/api/processes', async (req, res) => {
  try {
    const procs = await si.processes();
    const list = procs.list
      .sort((a, b) => b.cpu - a.cpu)
      .slice(0, 100)
      .map(p => ({
        pid: p.pid,
        name: p.name,
        cpu: p.cpu,
        mem: p.mem,
        memRss: p.memRss,
        user: p.user,
        state: p.state,
        started: p.started,
        command: p.command
      }));
    res.json({ total: procs.all, list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Kill process
app.delete('/api/processes/:pid', async (req, res) => {
  const pid = parseInt(req.params.pid);
  if (isNaN(pid) || pid <= 1) {
    return res.status(400).json({ error: 'Invalid PID' });
  }
  try {
    process.kill(pid, 'SIGTERM');
    res.json({ success: true, message: `Process ${pid} terminated` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

export default app;
