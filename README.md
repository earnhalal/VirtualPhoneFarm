# Virtual Phone Farm — Browser Control Panel

Ek hi browser dashboard (mobile par bhi khulta hai) se kai **asal Android phones**
control karein. Har phone ki apni Device ID, apna IP address, apna Android ID
aur apni storage hoti hai. Control sab ka **ek hi connection** (Control Hub)
se hota hai.

## System kaise kaam karta hai

```
Mobile / PC Browser  ──(1 WebSocket connection)──►  Control Hub (Node.js)
                                                          │ ADB commands
                              ┌───────────────┬───────────┼───────────────┐
                           VM-001           VM-002      VM-003   ... aur phones
                        172.28.0.11      172.28.0.12   172.28.0.13
                        (redroid = asal Android, Docker container mein)
```

- **Dashboard** (`public/index.html`): phones ki grid, live screenshot,
  screen par tap = asal phone par tap, Home/Back/Volume/Power, text bhejna,
  app kholna, reboot, aur **Broadcast mode** — ek action sab phones par ek saath.
- **Hub** (`hub/server.js`): har command ko asal ADB command mein badal kar
  sahi device ID par bhejta hai. `target: "ALL"` = sab phones.
- **Phones** (`docker-compose.yml`): har container ek asal Android 13 phone
  (redroid) hai — apna static IP, apni data volume (apps/data restart ke
  baad bhi mehfooz), apna ADB port (5555–5559 bahar se).

Asli phone bhi jod sakte hain: USB/WiFi ADB wala koi bhi phone
`POST /api/devices/register` se hub mein add ho jata hai.

## Chalana (Host PC par)

Shartein: Docker + Compose, KVM/Virtualization ON, Node 18+, `adb`
(Android platform-tools), taqreeban **2GB RAM per phone**.

```bash
bash setup.sh
```

Phir:
- Isi PC par: `http://localhost:8080`
- Mobile se (same WiFi): `http://<PC-ka-IP>:8080`

Phones zyada karne ke liye `docker-compose.yml` mein ek block copy karke
naya ID/IP/port dein, aur `hub/server.js` ki `FARM_LAYOUT` mein ek line add karein.

## Mobile se bahar (internet) se control

Hub ko seedha port-forward karke internet par **na** kholein.
Tailscale ya Cloudflare Tunnel se apne phone ko hi access dein — mehfooz aur free.

## Test

```bash
npm test   # hub routing, unique IDs/IPs, broadcast — sab verify karta hai
```

## Sach / limits

- Software 100% free/open-source hai (redroid, ADB, Node).
- Har phone ka **internal IP alag free** hai. Internet par har phone ka
  **alag public IP** chahiye to per-device proxy/VPN lagega (paid hota hai).
- Virtual phone mein asal SIM nahi hoti — calls/SMS SIM wale nahi honge,
  lekin apps, internet, accounts sab asal Android ki tarah chalenge.
