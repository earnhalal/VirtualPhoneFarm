// Virtual Phone Farm - Control Hub
// One server, one WebSocket connection from the browser dashboard.
// Every phone (redroid container or real phone over ADB) registers here
// with its OWN device id, its OWN docker-network IP, its OWN ADB address.
// Dashboard commands are translated to real ADB commands and routed
// to a single device, or broadcast to ALL devices at once.

const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const { execFile } = require('child_process');
const crypto = require('crypto');
const path = require('path');

const PORT = process.env.PORT || 8080;
const ADB = process.env.ADB_PATH || 'adb';

// ---------------------------------------------------------------- devices
// A device = { id, name, adbTarget, ip, androidId, model, status, lastSeen }
const devices = new Map();

function registerDevice(d) {
  const id = d.id || ('VM-' + String(devices.size + 1).padStart(3, '0'));
  const dev = {
    id,
    name: d.name || id,
    adbTarget: d.adbTarget || null,          // e.g. 172.28.0.11:5555 or emulator-5554
    ip: d.ip || null,                        // the device's own IP on the farm network
    androidId: d.androidId || crypto.randomBytes(8).toString('hex'),
    model: d.model || 'Virtual Android',
    android: d.android || '13',
    status: 'offline',
    lastSeen: null,
  };
  devices.set(id, dev);
  return dev;
}

// Seed the farm layout that docker-compose.yml creates. When the containers
// boot on the host PC, the hub probes them over ADB and flips them online.
const FARM_LAYOUT = [
  { id: 'VM-001', name: 'Phone 1', ip: '172.28.0.11', adbTarget: '172.28.0.11:5555' },
  { id: 'VM-002', name: 'Phone 2', ip: '172.28.0.12', adbTarget: '172.28.0.12:5555' },
  { id: 'VM-003', name: 'Phone 3', ip: '172.28.0.13', adbTarget: '172.28.0.13:5555' },
  { id: 'VM-004', name: 'Phone 4', ip: '172.28.0.14', adbTarget: '172.28.0.14:5555' },
  { id: 'VM-005', name: 'Phone 5', ip: '172.28.0.15', adbTarget: '172.28.0.15:5555' },
];
FARM_LAYOUT.forEach(registerDevice);

// ---------------------------------------------------------------- adb
function adb(device, args, opts = {}) {
  return new Promise((resolve) => {
    if (!device.adbTarget) return resolve({ ok: false, error: 'device has no ADB target' });
    execFile(ADB, ['-s', device.adbTarget, ...args],
      { timeout: opts.timeout || 15000, maxBuffer: 20 * 1024 * 1024, encoding: opts.binary ? 'buffer' : 'utf8' },
      (err, stdout) => resolve(err ? { ok: false, error: String(err.message || err) } : { ok: true, out: stdout }));
  });
}

// Translate one dashboard action into the real ADB command(s) for a device.
async function runAction(device, action) {
  const a = action || {};
  switch (a.type) {
    case 'tap':       return adb(device, ['shell', 'input', 'tap', String(a.x|0), String(a.y|0)]);
    case 'swipe':     return adb(device, ['shell', 'input', 'swipe', String(a.x1|0), String(a.y1|0), String(a.x2|0), String(a.y2|0), '300']);
    case 'text':      return adb(device, ['shell', 'input', 'text', String(a.text || '').replace(/ /g, '%s')]);
    case 'key': { // home=3 back=4 recent=187 volup=24 voldown=25 power=26 enter=66
      const keys = { home: 3, back: 4, recent: 187, volup: 24, voldown: 25, power: 26, enter: 66 };
      if (!(a.key in keys)) return { ok: false, error: 'unknown key' };
      return adb(device, ['shell', 'input', 'keyevent', String(keys[a.key])]);
    }
    case 'openApp':   return adb(device, ['shell', 'monkey', '-p', String(a.pkg || ''), '-c', 'android.intent.category.LAUNCHER', '1']);
    case 'installApk':return adb(device, ['install', '-r', String(a.path || '')], { timeout: 120000 });
    case 'reboot':    return adb(device, ['reboot']);
    case 'shell':     return adb(device, ['shell', String(a.cmd || '')]);
    default:          return { ok: false, error: 'unknown action type' };
  }
}

// Probe every device over ADB; a replying device is a REAL running Android.
async function probeDevices() {
  for (const dev of devices.values()) {
    if (!dev.adbTarget) continue;
    // make sure adb is connected to network targets
    await new Promise((r) => execFile(ADB, ['connect', dev.adbTarget], { timeout: 6000 }, () => r()));
    const res = await adb(dev, ['shell', 'getprop', 'ro.product.model'], { timeout: 6000 });
    if (res.ok) {
      dev.status = 'online';
      dev.lastSeen = new Date().toISOString();
      dev.model = String(res.out).trim() || dev.model;
      const aid = await adb(dev, ['shell', 'settings', 'get', 'secure', 'android_id'], { timeout: 6000 });
      if (aid.ok && aid.out.trim()) dev.androidId = aid.out.trim();
      const ver = await adb(dev, ['shell', 'getprop', 'ro.build.version.release'], { timeout: 6000 });
      if (ver.ok && ver.out.trim()) dev.android = ver.out.trim();
    } else {
      dev.status = 'offline';
    }
  }
  broadcast({ kind: 'devices', devices: [...devices.values()] });
}

// ---------------------------------------------------------------- http + ws
const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/devices', (req, res) => res.json([...devices.values()]));

app.post('/api/devices/register', (req, res) => {
  const dev = registerDevice(req.body || {});
  res.json(dev);
  broadcast({ kind: 'devices', devices: [...devices.values()] });
});

// One command endpoint: target = a device id, or "ALL" for broadcast.
app.post('/api/command', async (req, res) => {
  const { target, action } = req.body || {};
  const targets = target === 'ALL' ? [...devices.values()] : [devices.get(target)].filter(Boolean);
  if (!targets.length) return res.status(404).json({ ok: false, error: 'device not found' });
  const results = {};
  for (const dev of targets) results[dev.id] = await runAction(dev, action);
  res.json({ ok: true, results });
});

// Live screenshot straight from the real device screen (adb screencap).
app.get('/api/devices/:id/screenshot', async (req, res) => {
  const dev = devices.get(req.params.id);
  if (!dev) return res.status(404).end();
  const r = await adb(dev, ['exec-out', 'screencap', '-p'], { binary: true, timeout: 10000 });
  if (!r.ok) return res.status(503).json({ ok: false, error: 'device offline or no frame' });
  res.set('Content-Type', 'image/png');
  res.send(r.out);
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const dashboards = new Set();

function broadcast(msg) {
  const data = JSON.stringify(msg);
  for (const ws of dashboards) if (ws.readyState === 1) ws.send(data);
}

wss.on('connection', (ws) => {
  dashboards.add(ws);
  ws.send(JSON.stringify({ kind: 'devices', devices: [...devices.values()] }));
  ws.on('message', async (raw) => {
    let msg; try { msg = JSON.parse(raw); } catch { return; }
    if (msg.kind === 'command') {
      const targets = msg.target === 'ALL' ? [...devices.values()] : [devices.get(msg.target)].filter(Boolean);
      const results = {};
      for (const dev of targets) results[dev.id] = await runAction(dev, msg.action);
      ws.send(JSON.stringify({ kind: 'result', target: msg.target, results }));
    }
  });
  ws.on('close', () => dashboards.delete(ws));
});

server.listen(PORT, () => {
  console.log(`Virtual Phone Farm hub running: http://localhost:${PORT}`);
  probeDevices();
  setInterval(probeDevices, 30000); // keep online/offline + screens honest
});
