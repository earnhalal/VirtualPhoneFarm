// Hub test: server start karke API + WebSocket + broadcast routing verify karta hai.
// Asal Android yahan nahi hai, is liye ADB commands "offline" ayenge -
// routing, device IDs, IPs aur ek-connection wala hisaab yahin prove hota hai.
const { spawn } = require('child_process');
const WebSocket = require('ws');

const srv = spawn('node', ['hub/server.js'], { env: { ...process.env, PORT: '8091' }, stdio: 'pipe' });
const wait = (ms) => new Promise(r => setTimeout(r, ms));
let failed = false;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + '  ' + name); if (!ok) failed = true; };

(async () => {
  await wait(1500);
  const devs = await (await fetch('http://localhost:8091/api/devices')).json();
  check('5 devices registered', devs.length === 5);
  check('har device ki apni ID', new Set(devs.map(d => d.id)).size === 5);
  check('har device ka apna IP', new Set(devs.map(d => d.ip)).size === 5 && devs[0].ip === '172.28.0.11');
  check('har device ka apna Android ID', new Set(devs.map(d => d.androidId)).size === 5);

  const ws = new WebSocket('ws://localhost:8091');
  const got = [];
  ws.on('message', d => got.push(JSON.parse(d)));
  await wait(600);
  check('dashboard ko ek WS connection par devices milay', got.some(m => m.kind === 'devices'));
  ws.send(JSON.stringify({ kind: 'command', target: 'ALL', action: { type: 'key', key: 'home' } }));
  await wait(1200);
  const res = got.find(m => m.kind === 'result');
  check('broadcast ALL -> 5 devices tak command gaya', res && Object.keys(res.results).length === 5);
  check('offline device par jhooti success nahi (asal ADB jawab)', res && Object.values(res.results).every(r => r.ok === false));

  const html = await (await fetch('http://localhost:8091/')).text();
  check('mobile dashboard serve ho raha hai', html.includes('Virtual Phone Farm'));

  ws.close(); srv.kill();
  console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: ALL PASS');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); srv.kill(); process.exit(1); });
