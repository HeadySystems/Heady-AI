<!--
  © 2026 Heady Systems LLC.
  PROPRIETARY AND CONFIDENTIAL.
  Unauthorized copying, modification, or distribution is strictly prohibited.
-->
# Heady Local Deployment Guide
## Complete Migration from Render to Local Computer

This guide helps you migrate all Heady services from Render.com to your local computer while keeping Render as a free-tier backup.

### 🎯 What This Accomplishes

- **Primary**: All services run locally on your computer
- **Backup**: Render services downgraded to free tier
- **Performance**: Full control over resources (Ryzen 9 optimization)
- **Cost**: Free tier backup ($0/month)
- **Reliability**: Local services with cloud backup

### 📋 Prerequisites

- Docker & Docker Compose installed
- 16GB+ RAM recommended (for AI models)
- 100GB+ free disk space
- Public IP for production deployment
- Domain names configured

### 🚀 Quick Start

```bash
# 1. Configure environment
cp .env.local.example .env.local
# Edit .env.local with your API keys and passwords

# 2. Run migration
./scripts/migrate-to-local.sh

# 3. Test services
./scripts/local-service-manager.sh status
```

### 📁 File Structure

```
/home/headyme/CascadeProjects/
├── docker-compose.local.yml          # Local services configuration
├── config/
│   ├── nginx.conf                    # Reverse proxy configuration
│   ├── prometheus.yml                # Monitoring configuration
│   └── ssl/                          # SSL certificates
├── scripts/
│   ├── migrate-to-local.sh           # Migration script
│   ├── backup-to-render.sh           # Backup to Render
│   └── local-service-manager.sh      # Service management
├── Heady/
│   ├── admin-ui/                     # Next.js frontend
│   ├── web/                          # Drupal CMS
│   └── HeadyAcademy/                 # Python AI worker
└── backup/                           # Backup storage
```

### 🛠️ Services Running Locally

| Service | Container | Port | Purpose |
|---------|-----------|------|---------|
| PostgreSQL | heady-postgres-local | 5432 | Database |
| Redis | heady-redis-local | 6379 | Cache |
| Drupal CMS | heady-drupal-cms-local | 8080 | Content management |
| Next.js | heady-nextjs-frontend-local | 3000 | Frontend |
| Heady Manager | heady-manager-local | 3300 | API orchestrator |
| Python Worker | heady-python-worker-local | 5000 | AI processing |
| Nginx | heady-nginx-local | 80/443 | Reverse proxy |
| Prometheus | heady-prometheus-local | 9090 | Monitoring |
| Grafana | heady-grafana-local | 3001 | Dashboards |
| Ollama | heady-ollama-local | 11434 | Local LLM |
| Qdrant | heady-qdrant-local | 6333 | Vector DB |

### 🌐 Domain Configuration

#### Production DNS Setup
```
headyme.com → YOUR_PUBLIC_IP
chat.headyme.com → YOUR_PUBLIC_IP
manager.headyme.com → YOUR_PUBLIC_IP
```

#### Local Testing (add to /etc/hosts)
```
api.headysystems.com headyme.com
api.headysystems.com chat.headyme.com
api.headysystems.com manager.headyme.com
```

### 🔧 Service Management

```bash
# Show all service status
./scripts/local-service-manager.sh status

# Start/stop services
./scripts/local-service-manager.sh start [service]
./scripts/local-service-manager.sh stop [service]

# View logs
./scripts/local-service-manager.sh logs manager -f

# Health check all services
./scripts/local-service-manager.sh health

# Auto-recover failed services
./scripts/local-service-manager.sh recover

# System metrics
./scripts/local-service-manager.sh metrics
```

### 📊 Monitoring

- **Grafana**: https://api.headysystems.com (admin: your password)
- **Prometheus**: https://api.headysystems.com
- **Service Health**: Built-in health endpoints

### 💾 Backup Strategy

#### Automatic Backup
```bash
# Backup to Render (free tier)
./scripts/backup-to-render.sh
```

#### Manual Backup
```bash
# Export database
docker exec heady-postgres-local pg_dump -U heady heady_production > backup.sql

# Backup files
docker cp heady-drupal-cms-local:/var/www/html/web/sites/default/files ./backup/
```

### 🔄 Switching Between Local and Render

#### Switch to Local (Primary)
```bash
# 1. Start local services
./scripts/local-service-manager.sh start

# 2. Update DNS to point to your IP
# 3. Verify all services work
./scripts/local-service-manager.sh health
```

#### Switch to Render (Emergency)
```bash
# 1. Update DNS to point to Render URLs
# 2. Scale up Render services via API
# 3. Restore data if needed
```

### ⚡ Performance Optimization

#### Ryzen 9 CPU Optimization
- Services configured for 16-core utilization
- CPU affinity set for AI workloads
- Priority scheduling for critical services

#### Memory Management
- PostgreSQL: 8GB allocated
- Ollama: 16GB for AI models
- Heady Manager: 8GB for orchestration
- Next.js: 4GB for frontend

#### Storage Optimization
- SSD storage for databases
- Separate volumes for logs and cache
- Automatic cleanup of old data

### 🔒 Security Configuration

#### SSL Certificates
```bash
# For production, use Let's Encrypt:
certbot --nginx -d headyme.com -d chat.headyme.com -d manager.headyme.com
```

#### Firewall Rules
```bash
# Allow only necessary ports
ufw allow 22    # SSH
ufw allow 80    # HTTP
ufw allow 443   # HTTPS
ufw enable
```

### 🐛 Troubleshooting

#### Service Won't Start
```bash
# Check logs
./scripts/local-service-manager.sh logs [service]

# Check resources
./scripts/local-service-manager.sh metrics

# Restart service
./scripts/local-service-manager.sh restart [service]
```

#### Out of Memory
```bash
# Check memory usage
docker stats

# Cleanup unused resources
./scripts/local-service-manager.sh cleanup

# Adjust memory limits in docker-compose.local.yml
```

#### Network Issues
```bash
# Check container networking
docker network ls
docker network inspect headyme_heady-network

# Restart network
docker-compose -f docker-compose.local.yml down
docker-compose -f docker-compose.local.yml up -d
```

### 📈 Scaling Services

```bash
# Scale specific services
./scripts/local-service-manager.sh scale python-worker 3
./scripts/local-service-manager.sh scale nextjs 2

# Edit docker-compose.local.yml for permanent scaling
```

### 🔄 Continuous Integration

#### Git Hooks (Auto-deploy on push)
```bash
# Add to .git/hooks/post-receive
#!/bin/bash
cd /home/headyme/CascadeProjects
git pull origin main
./scripts/local-service-manager.sh restart
```

#### Automated Backups
```bash
# Add to crontab
0 2 * * * /home/headyme/CascadeProjects/scripts/backup-to-render.sh
```

### 📞 Support

#### Health Check URLs
- Main site: https://headyme.com/health
- Manager API: https://manager.headyme.com/api/health
- Drupal admin: https://headyme.com/admin/health

#### Emergency Recovery
```bash
# Complete system restart
./scripts/local-service-manager.sh stop
./scripts/local-service-manager.sh cleanup
./scripts/local-service-manager.sh start

# Restore from backup
./scripts/backup-to-render.sh --restore
```

### 🎉 Success Criteria

✅ All services running locally  
✅ Health checks passing  
✅ DNS pointing to local server  
✅ SSL certificates configured  
✅ Monitoring active  
✅ Backup system working  
✅ Performance optimized  

Your Heady project is now running locally with Render as a free-tier backup!
