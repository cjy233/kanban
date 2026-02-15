import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from './app.js';

describe('GET /api/stats', () => {
  it('returns system stats with expected shape', async () => {
    const res = await request(app).get('/api/stats');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('cpu');
    expect(res.body).toHaveProperty('memory');
    expect(res.body).toHaveProperty('disk');
    expect(res.body).toHaveProperty('network');
    expect(res.body).toHaveProperty('os');
    expect(res.body).toHaveProperty('uptime');
  });

  it('cpu has usage and cores', async () => {
    const res = await request(app).get('/api/stats');
    expect(typeof res.body.cpu.usage).toBe('number');
    expect(Array.isArray(res.body.cpu.cores)).toBe(true);
  });

  it('memory has required fields', async () => {
    const res = await request(app).get('/api/stats');
    const mem = res.body.memory;
    expect(typeof mem.total).toBe('number');
    expect(typeof mem.used).toBe('number');
    expect(typeof mem.free).toBe('number');
    expect(typeof mem.available).toBe('number');
    expect(typeof mem.usedPercent).toBe('number');
  });
});

describe('GET /api/processes', () => {
  it('returns process list', async () => {
    const res = await request(app).get('/api/processes');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('list');
    expect(Array.isArray(res.body.list)).toBe(true);
  });

  it('each process has expected fields', async () => {
    const res = await request(app).get('/api/processes');
    const proc = res.body.list[0];
    expect(proc).toHaveProperty('pid');
    expect(proc).toHaveProperty('name');
    expect(proc).toHaveProperty('cpu');
    expect(proc).toHaveProperty('mem');
    expect(proc).toHaveProperty('user');
    expect(proc).toHaveProperty('command');
  });

  it('returns at most 100 processes', async () => {
    const res = await request(app).get('/api/processes');
    expect(res.body.list.length).toBeLessThanOrEqual(100);
  });
});

describe('DELETE /api/processes/:pid', () => {
  it('rejects invalid PID', async () => {
    const res = await request(app).delete('/api/processes/abc');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid PID');
  });

  it('rejects PID 0', async () => {
    const res = await request(app).delete('/api/processes/0');
    expect(res.status).toBe(400);
  });

  it('rejects PID 1', async () => {
    const res = await request(app).delete('/api/processes/1');
    expect(res.status).toBe(400);
  });

  it('returns 500 for non-existent PID', async () => {
    const res = await request(app).delete('/api/processes/999999');
    expect(res.status).toBe(500);
  });
});
