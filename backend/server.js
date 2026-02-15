import express from 'express';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import si from 'systeminformation';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 7777;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Get system stats
app.get('/api/stats', async (req, res) => {
  try {
    const [cpu, mem, osInfo, time, disk, network] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.osInfo(),
      si.time(),
      si.fsSize(),
      si.networkStats()
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

const server = createServer(app);

// WebSocket
const wss = new WebSocketServer({ server, path: '/ws' });
const wsClients = new Set();

wss.on('connection', (ws) => {
  wsClients.add(ws);
  ws.on('close', () => wsClients.delete(ws));
});

// Broadcast stats every 3 seconds
setInterval(async () => {
  if (wsClients.size === 0) return;
  try {
    const [cpu, mem] = await Promise.all([si.currentLoad(), si.mem()]);
    const data = JSON.stringify({
      type: 'stats',
      timestamp: Date.now(),
      cpu: { usage: cpu.currentLoad, cores: cpu.cpus.map(c => c.load) },
      memory: { 
        total: mem.total, 
        used: mem.used, 
        available: mem.available,
        usedPercent: ((mem.total - mem.available) / mem.total) * 100 
      }
    });
    wsClients.forEach(ws => {
      if (ws.readyState === 1) ws.send(data);
    });
  } catch (err) {
    console.error('Broadcast error:', err.message);
  }
}, 3000);

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
