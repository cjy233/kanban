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
