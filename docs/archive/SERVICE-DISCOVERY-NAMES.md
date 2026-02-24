# 🌩️ HeadyClouds Service Discovery Configuration
# Simple, memorable service names for easy access

## 🏷️ Service Name Mapping

### 📱 **Simple Service Names** (Recommended)
```
headyme:3000        → HeadyMe Cloud Sync Service
production:3301     → Production Monorepos Service
postgres:5432       → PostgreSQL Database
redis:6379          → Redis Cache
minio:9000          → File Storage
monitoring:3000     → Grafana Dashboard
prometheus:9090     → Metrics Collection
alertmanager:9093  → Alert Management
```

### 🌐 **Alternative Domain Names**
```
headyme.local:3000      → HeadyMe Service
production.local:3301   → Production Service
db.local:5432          → Database
cache.local:6379       → Redis Cache
storage.local:9000     → File Storage
dash.local:3000        → Monitoring Dashboard
metrics.local:9090     → Prometheus
alerts.local:9093      → Alertmanager
```

## 🔧 **Docker Compose Service Names**

### Updated Configuration
```yaml
services:
  headyme:
    hostname: headyme
    ports: ["3000:3000"]
    
  production:
    hostname: production  
    ports: ["3301:3301"]
    
  postgres:
    hostname: postgres
    ports: ["5432:5432"]
    
  redis:
    hostname: redis
    ports: ["6379:6379"]
    
  minio:
    hostname: minio
    ports: ["9000:9000"]
    
  monitoring:
    hostname: monitoring
    ports: ["3000:3000"]
```

## 📋 **Access Methods**

### 🚀 **Direct Service Access**
```bash
# HeadyMe Sync Service
curl http://headyme:3000/api/health

# Production Sync Service  
curl http://production:3301/api/health

# Database Connection
psql -h postgres -p 5432 -U headyclouds

# Redis Connection
redis-cli -h redis -p 6379

# File Storage
mc alias set minio http://minio:9000

# Monitoring Dashboard
http://monitoring:3000
```

### 🌐 **Internal DNS Resolution**
```bash
# Test service discovery
nslookup headyme
nslookup production
nslookup postgres
nslookup redis
nslookup minio
nslookup monitoring
```

## 🎯 **Benefits of Simple Names**

### ✅ **Advantages**
- **Memorable**: Easy to remember and type
- **Intuitive**: Clear service identification
- **Short**: Less typing, fewer errors
- **Standard**: Follows common naming conventions
- **Flexible**: Easy to change and maintain

### 🔄 **Service Discovery**
- **Docker Internal DNS**: Automatic name resolution
- **Container Links**: Direct container communication
- **Network Aliases**: Multiple name support
- **Environment Variables**: Dynamic configuration

## 🛠️ **Implementation**

### 📝 **Docker Compose Updates**
```yaml
services:
  headyme:
    container_name: headyclouds-headyme
    hostname: headyme
    networks:
      app-network:
        aliases:
          - headyme
          - headyme-sync
    
  production:
    container_name: headyclouds-production
    hostname: production
    networks:
      app-network:
        aliases:
          - production
          - production-sync
```

### 🔗 **Network Configuration**
```yaml
networks:
  app-network:
    driver: bridge
    internal: true
    enable_dns: true
    dns_search: [headyclouds.local]
```

## 🚀 **Usage Examples**

### 📡 **API Endpoints**
```bash
# HeadyMe Sync API
http://headyme:3000/api/sync/status
http://headyme:3000/api/sync/start
http://headyme:3000/api/sync/stop

# Production Sync API
http://production:3301/api/repo/status
http://production:3301/api/repo/sync
http://production:3301/api/repo/clone
```

### 🗄️ **Database Connections**
```bash
# PostgreSQL
postgresql://headyclouds:password@postgres:5432/headyclouds

# Redis
redis://:password@redis:6379/0

# MinIO S3
http://minio:9000
```

### 📊 **Monitoring Access**
```bash
# Grafana Dashboard
http://monitoring:3000/d/headyclouds-security

# Prometheus Metrics
http://prometheus:9090/api/v1/query?query=up

# Alertmanager
http://alertmanager:9093/api/v1/alerts
```

## 🎉 **Recommendation**

**Use simple service names** like `headyme:3000` and `production:3301` because they are:

1. **More intuitive** than long domain names
2. **Easier to remember** and type
3. **Standard practice** in container environments
4. **Automatically resolved** by Docker's internal DNS
5. **Flexible** for future changes

This approach provides the same security benefits with much better usability! 🚀
