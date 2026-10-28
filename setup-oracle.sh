#!/usr/bin/env bash
# Virtual Phone Farm — Oracle Cloud Always Free (ARM) one-time setup
# Chalana: Oracle Ubuntu ARM VM par SSH karke:
#   git clone https://github.com/earnhalal/VirtualPhoneFarm && cd VirtualPhoneFarm
#   bash setup-oracle.sh
set -e
cd "$(dirname "$0")"

echo "== 1/6 System packages =="
sudo apt-get update
sudo apt-get install -y linux-modules-extra-$(uname -r) docker.io adb git curl

echo "== 2/6 Android kernel modules (redroid ke liye lazmi) =="
echo -e "binder_linux\nashmem_linux" | sudo tee /etc/modules-load.d/redroid.conf >/dev/null
sudo modprobe binder_linux devices="binder,hwbinder,vndbinder" || true
sudo modprobe ashmem_linux || true
ls /dev/binder* >/dev/null 2>&1 && echo "binder OK" || echo "WARNING: binder device abhi nahi bana — VM ko ek dafa reboot karke script dobara chalain."

echo "== 3/6 Docker =="
sudo systemctl enable --now docker
sudo usermod -aG docker $USER || true

echo "== 4/6 Phones start (4 asal Android, ARM images) =="
sudo docker compose -f docker-compose.oracle.yml up -d
echo "Phones boot ho rahe hain, 1-2 minute intezaar..."
sleep 45
sudo docker ps --format "{{.Names}}  {{.Status}}"

echo "== 5/6 Node.js (hub ke liye) =="
if ! command -v node >/dev/null || [ "$(node -v | cut -dv -f2 | cut -d. -f1)" -lt 18 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
npm install --omit=dev

echo "== 6/6 Hub ko service bana kar start =="
sudo tee /etc/systemd/system/phonefarm-hub.service >/dev/null <<EOF
[Unit]
Description=Virtual Phone Farm Hub
After=docker.service network-online.target
[Service]
WorkingDirectory=$(pwd)
ExecStart=/usr/bin/node hub/server.js
Environment=PORT=8080
Restart=always
User=$USER
[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now phonefarm-hub
sleep 3
curl -s http://localhost:8080/api/devices | head -c 300 || true

echo ""
echo "=================================================="
echo "TAYAR. Ab access ki baat — AHEM HIFAZAT:"
echo "Hub port 8080 ko Oracle console mein PUBLIC na kholein, warna koi bhi"
echo "aapke phones control kar sakta hai. Mehfooz aur free tareeqa:"
echo "  1) Is VM aur apne mobile, dono par Tailscale install karein (free)"
echo "  2) Mobile browser mein http://<VM-ka-Tailscale-IP>:8080 kholein"
echo "Phones isi dashboard par ONLINE nazar ayenge."
echo "=================================================="
