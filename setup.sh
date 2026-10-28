#!/usr/bin/env bash
# Virtual Phone Farm - one-time setup on the HOST PC (Linux) or VPS.
# Windows ke liye: pehle Docker Desktop + WSL2 install karein, phir yehi
# script WSL (Ubuntu) terminal mein chalain, aur setup-windows.bat bhi hai.
set -e
cd "$(dirname "$0")"

echo "== 1/5 Docker check =="
command -v docker >/dev/null || { echo "Docker nahi mila. Pehle Docker install karein: https://docs.docker.com/get-docker/"; exit 1; }
docker compose version >/dev/null || { echo "Docker Compose nahi mila."; exit 1; }

echo "== 2/5 KVM check (virtual phones ke liye lazmi) =="
if [ -e /dev/kvm ]; then echo "KVM OK"; else echo "WARNING: /dev/kvm nahi mila - BIOS mein Virtualization ON karein, warna phones boot nahi honge."; fi

echo "== 3/5 binder modules (redroid ke liye, Linux host) =="
if lsmod | grep -q binder_linux; then echo "binder OK"; else
  echo "binder_linux load karne ki koshish... (sudo lagega)"
  sudo modprobe binder_linux devices="binder,hwbinder,vndbinder" || echo "modprobe fail - apne distro ke hisaab se binder module enable karein."
fi

echo "== 4/5 Phones start (har container = 1 real Android) =="
docker compose up -d
echo "Phones boot ho rahe hain, 1-2 minute intezaar..."
sleep 30

echo "== 5/5 Control hub start =="
command -v node >/dev/null || { echo "Node.js nahi mila - hub ke liye Node 18+ install karein: https://nodejs.org"; exit 1; }
command -v adb >/dev/null || echo "NOTE: 'adb' nahi mila - Android platform-tools install karke PATH mein dalen, warna hub phones ko probe nahi kar payega."
npm install --omit=dev
echo ""
echo "Sab tayar hai. Hub chal raha hai:"
echo "  Isi PC par:      http://localhost:8080"
echo "  Mobile se:       http://<is-PC-ka-LAN-IP>:8080   (PC aur mobile ek hi WiFi par hon)"
echo "  Bahar se access: router port-forward ya Tailscale/Cloudflare Tunnel use karein (hub ko seedha internet par open na karein)."
PORT=8080 node hub/server.js
