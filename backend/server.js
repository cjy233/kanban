import { WebSocketServer } from 'ws';
import si from 'systeminformation';
import { createServer } from 'http';
import app from './app.js';

const PORT = 7777;

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
    const [cpu, mem, network] = await Promise.all([si.currentLoad(), si.mem(), si.networkStats()]);
    const data = JSON.stringify({
      type: 'stats',
      timestamp: Date.now(),
      cpu: { usage: cpu.currentLoad, cores: cpu.cpus.map(c => c.load) },
      memory: {
        total: mem.total,
        used: mem.used,
        available: mem.available,
        usedPercent: ((mem.total - mem.available) / mem.total) * 100
      },
      network: network.map(n => ({
        iface: n.iface,
        rxSec: n.rx_sec,
        txSec: n.tx_sec
      }))
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
