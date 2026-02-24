# ⚡ HeadyStack + HeadyBuddy - Quick Deployment Commands

## 🚀 ONE-COMMAND COMPLETE DEPLOYMENT

```bash
# Complete HeadyStack + HeadyBuddy deployment
cd ~/HeadyStack && \
sudo ./alternative-mesh-setup.sh && headybuddy-continuity start && \
chmod +x scripts/install-parrot-windsurf.sh && ./scripts/install-parrot-windsurf.sh && \
chmod +x scripts/configure-parrot-windsurf.sh && ./scripts/configure-parrot-windsurf.sh && \
windsurf
```

## 📋 STEP-BY-STEP FAST TRACK

### Step 1: Start HeadyBuddy Sync Network
```bash
sudo ./alternative-mesh-setup.sh && headybuddy-continuity start
```

### Step 2: Install HeadyStack
```bash
cd ~/HeadyStack
chmod +x scripts/install-parrot-windsurf.sh
./scripts/install-parrot-windsurf.sh
```

### Step 3: Configure Environment
```bash
chmod +x scripts/configure-parrot-windsurf.sh
./scripts/configure-parrot-windsurf.sh
```

### Step 4: Launch Windsurf
```bash
windsurf
```

## 🎯 ESSENTIAL VERIFICATION COMMANDS

### Check All Services Status
```bash
echo "=== HeadyBuddy Sync ===" && headybuddy-continuity status && \
echo "=== Network Status ===" && ip addr show wlp3s0 | grep "inet " && \
echo "=== Windsurf Status ===" && windsurf --version && \
echo "=== MCP Servers ===" && windsurf --test-mcp && \
echo "=== Security Tools ===" && which nmap metasploit wireshark burpsuite
```

### Quick Health Check
```bash
# Test all critical services
curl -f http://localhost:8384/rest/system/ping && \
curl -f http://192.168.100.1:8080/current-session.json && \
curl -f http://manager.dev.local.heady.internal:3300/api/health && \
echo "✅ All services operational"
```

## 📱 DEVICE MANAGEMENT

### Add New Device (One-Liner)
```bash
./setup-new-device.sh laptop && echo "Device ready for pairing"
```

### View All Device IDs
```bash
cat ~/.config/syncthing/device-registry.json | jq -r '.devices | to_entries[] | "\(.key): \(.value.name) - \(.value.id)"'
```

### Check Connected Devices
```bash
arp -a | grep 192.168.100 | wc -l | echo "Connected devices: $(cat)"
```

## 🔧 TROUBLESHOOTING QUICK FIXES

### Full System Reset
```bash
headybuddy-continuity stop && sudo systemctl restart hostapd dnsmasq && \
systemctl --user restart syncthing && headybuddy-continuity start
```

### Fix Common Issues
```bash
# Permission fixes
sudo usermod -aG docker $USER && sudo chown -R $USER:$USER ~/.config/windsurf ~/.config/syncthing

# Network fixes
sudo systemctl restart NetworkManager && sudo ./alternative-mesh-setup.sh

# Service restarts
systemctl --user restart syncthing && headybuddy-continuity restart
```

## 📊 MONITORING COMMANDS

### Real-time System Monitor
```bash
watch -n 5 'echo "=== CPU/Memory ===" && free -h && echo "=== Sync Status ===" && headybuddy-continuity status && echo "=== Network ===" && ip route | grep default'
```

### Performance Metrics
```bash
windsurf --metrics && \
curl -s http://localhost:8384/rest/system/status | jq '.globalBytes' && \
curl -s http://192.168.100.1:8080/current-session.json | jq '.device_name'
```

## 🚀 PROJECT CREATION

### Security Audit Project
```bash
windsurf --template security-audit $(date +%Y-%m-%d)-audit && cd $(date +%Y-%m-%d)-audit && echo "Project ready - synced across devices"
```

### Penetration Testing Project
```bash
windsurf --template pentest client-pentest-$(date +%Y%m%d) && cd client-pentest-$(date +%Y%m%d) && ./scripts/initial_scan.sh
```

## 🛡️ SECURITY TOOLS QUICK START

### Network Reconnaissance
```bash
nmap -T4 -A target.local && wireshark -k
```

### Web Application Testing
```bash
sqlmap -u "http://target.com" --batch && nikto -h http://target.com
```

### Password Cracking
```bash
john --wordlist=rockyou.txt hashfile && hashcat -m 0 -a 0 hashfile rockyou.txt
```

## 📱 MOBILE INTEGRATION

### Setup Mobile Device
```bash
# Install Syncthing on mobile (F-Droid/App Store)
# Connect to HeadyBuddySync WiFi
# Add device ID: HEADY-5bdacd5-4b360f2-8007a35-af270dc-2fa8
# Select folders to sync
```

### Test Mobile Sync
```bash
# Create test file
echo "Mobile sync test $(date)" > ~/Documents/mobile-test.txt

# Check sync status
curl -s http://localhost:8384/rest/system/status | jq '.globalBytes'
```

## 🔐 SECURITY QUICK CHECKS

### Firewall Status
```bash
sudo ufw status verbose && echo "=== Open Ports ===" && sudo netstat -tlnp | grep -E "(3000|3300|8080|8384)"
```

### Audit Log Check
```bash
echo "HEADY_AUDIT_LOG: $HEADY_AUDIT_LOG" && \
echo "WINDSURF_SANDBOX: $WINDSURF_SANDBOX" && \
windsurf --security-check
```

## 🎯 DAILY WORKFLOW

### Morning Startup
```bash
# Start all services
sudo ./alternative-mesh-setup.sh && headybuddy-continuity start && windsurf

# Check system health
~/headybuddy-monitor.sh
```

### During Development
```bash
# Monitor sync
watch -n 30 'curl -s http://192.168.100.1:8080/current-session.json | jq -r ".device_name + \" - \" + .cwd"'

# Check build status
npm run build && echo "Build completed - synced to all devices"
```

### End of Day
```bash
# Backup configuration
tar -czf headystack-backup-$(date +%Y%m%d).tar.gz ~/.config/windsurf ~/.config/syncthing ~/HeadyStack

# Generate report
windsurf --generate-report > daily-report-$(date +%Y%m%d).json
```

## 🚨 EMERGENCY COMMANDS

### Complete Shutdown
```bash
headybuddy-continuity stop && sudo systemctl stop hostapd dnsmasq && systemctl --user stop syncthing && pkill -f windsurf
```

### Emergency Backup
```bash
tar -czf emergency-backup-$(date +%Y%m%d-%H%M%S).tar.gz \
  ~/.config/windsurf \
  ~/.config/syncthing \
  ~/HeadyStack \
  ~/setup-new-device.sh \
  ~/branded-device-setup.sh
```

### Service Recovery
```bash
# Recover from crash
sudo ./alternative-mesh-setup.sh && \
headybuddy-continuity start && \
systemctl --user restart syncthing && \
windsurf --clear-cache && windsurf
```

---

## 🎯 SUCCESS INDICATORS

### ✅ System Ready When:
```bash
# All services running
headybuddy-continuity status | grep running && \
windsurf --version && \
curl -f http://localhost:8384/rest/system/ping

# Network active
iwgetid -r | grep HeadyBuddySync && \
ping -c 1 192.168.100.1

# Tools accessible
which nmap metasploit wireshark && \
echo "🚀 HeadyStack + HeadyBuddy fully operational!"
```

---

**⚡ Copy-paste these commands for rapid deployment and management!** 🚀
