# 🎯 **HEADING CODING AGENT - MASTER INSTRUCTION SET v4.0**

## 🚨 **CRITICAL EMERGENCY PROTOCOL - EXECUTE IMMEDIATELY**

### **🔥 STEP 1: SYSTEM DIAGNOSTICS (5 minutes)**
```bash
# Create comprehensive diagnostic report
mkdir -p .heady/diagnostics
cd .heady/diagnostics

# Capture system state
echo "=== HEADING SYSTEM DIAGNOSTIC REPORT ===" > diagnostic-$(date +%Y%m%d-%H%M%S).txt
echo "Timestamp: $(date)" >> diagnostic-*.txt
echo "User: HeadyConnection Inc." >> diagnostic-*.txt
echo "" >> diagnostic-*.txt

# Check memory system
echo "=== MEMORY SYSTEM STATUS ===" >> diagnostic-*.txt
find . -name "*memor*" -o -name "*learn*" -o -name "*.db" >> diagnostic-*.txt 2>&1
du -sh .heady/* >> diagnostic-*.txt 2>&1
echo "" >> diagnostic-*.txt

# Check for localhost references (FORBIDDEN)
echo "=== LOCALHOST VIOLATIONS CHECK ===" >> diagnostic-*.txt
grep -r "localhost" . --include="*.js" --include="*.ts" --include="*.json" --include="*.env*" | head -20 >> diagnostic-*.txt 2>&1
grep -r "127.0.0.1" . --include="*.js" --include="*.ts" --include="*.json" | head -10 >> diagnostic-*.txt 2>&1
grep -r "onrender" . --include="*.js" --include="*.ts" --include="*.json" | head -10 >> diagnostic-*.txt 2>&1
echo "" >> diagnostic-*.txt

# Check running services
echo "=== RUNNING SERVICES ===" >> diagnostic-*.txt
netstat -tuln | grep LISTEN >> diagnostic-*.txt 2>&1
ps aux | grep -E 'node|python|npm|docker|drupal' | grep -v grep >> diagnostic-*.txt 2>&1
echo "" >> diagnostic-*.txt

# Check Drupal status
echo "=== DRUPAL STATUS ===" >> diagnostic-*.txt
which drupal >> diagnostic-*.txt 2>&1
which composer >> diagnostic-*.txt 2>&1
composer show drupal/core >> diagnostic-*.txt 2>&1
echo "" >> diagnostic-*.txt

# Check recent errors
echo "=== RECENT ERRORS ===" >> diagnostic-*.txt
find . -name "*.log" -mtime -1 -exec tail -20 {} \; >> diagnostic-*.txt 2>&1
echo "" >> diagnostic-*.txt

# Check websites functionality
echo "=== WEBSITE FUNCTIONALITY TEST ===" >> diagnostic-*.txt
curl -s -o /dev/null -w "HeadyMe: %{http_code}\n" http://localhost:9000 >> diagnostic-*.txt 2>&1
curl -s -o /dev/null -w "HeadyConnection: %{http_code}\n" http://localhost:8080 >> diagnostic-*.txt 2>&1
curl -s -o /dev/null -w "NextJS: %{http_code}\n" http://localhost:3000 >> diagnostic-*.txt 2>&1

cat diagnostic-*.txt
```

### **🔥 STEP 2: FRONTEND CRASH FIX (15 minutes)**
```javascript
// scripts/emergency-frontend-fix.js
const fs = require('fs');
const path = require('path');

console.log('🚨 HEADING EMERGENCY FRONTEND FIX');
console.log('================================\n');

// 1. Check for common frontend killers
const checks = {
  'package.json exists': fs.existsSync('package.json'),
  'node_modules exists': fs.existsSync('node_modules'),
  'public/index.html exists': fs.existsSync('public/index.html') || fs.existsSync('index.html'),
  'src directory exists': fs.existsSync('src'),
  'Drupal web root': fs.existsSync('web') || fs.existsSync('docroot')
};

console.log('📋 File System Checks:');
Object.entries(checks).forEach(([check, passed]) => {
  console.log(`  ${passed ? '✅' : '❌'} ${check}`);
});

// 2. Check for broken imports/syntax
console.log('\n🔍 Checking for common errors...');
const jsFiles = require('glob') ? require('glob').sync('src/**/*.{js,jsx,ts,tsx}') : [];
let errors = [];

jsFiles.forEach(file => {
  try {
    const content = fs.readFileSync(file, 'utf8');
    
    // Check for localhost hardcoding (FORBIDDEN)
    if (content.includes('localhost') || content.includes('127.0.0.1')) {
      errors.push(`${file}: ❌ CONTAINS LOCALHOST REFERENCE (FORBIDDEN)`);
    }
    
    // Check for onrender references (FORBIDDEN)
    if (content.includes('onrender')) {
      errors.push(`${file}: ❌ CONTAINS ONRENDER REFERENCE (FORBIDDEN)`);
    }
    
    // Check for missing event handlers
    if (content.match(/onClick=\{\}/g)) {
      errors.push(`${file}: Empty onClick handler`);
    }
    
    // Check for broken imports
    if (content.match(/import .* from ['"][^'"]*localhost[^'"]*['"]/)) {
      errors.push(`${file}: Import from localhost URL`);
    }
  } catch (err) {
    errors.push(`${file}: Error reading file - ${err.message}`);
  }
});

if (errors.length > 0) {
  console.log('\n❌ CRITICAL ERRORS FOUND:');
  errors.forEach(err => console.log(`  - ${err}`));
} else {
  console.log('✅ No obvious errors found');
}

// 3. Generate minimal working index.html
const minimalHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🌌 HeadyConnection - Emergency Recovery</title>
  <style>
    body { 
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      max-width: 800px; 
      margin: 50px auto; 
      padding: 20px;
      background: linear-gradient(135deg, #0A0A0F, #1A1A2E);
      color: #FFFFFF;
      min-height: 100vh;
    }
    .status { 
      padding: 15px; 
      margin: 10px 0; 
      border-radius: 8px;
      border: 1px solid rgba(0, 217, 255, 0.3);
    }
    .error { 
      background: rgba(255, 0, 128, 0.1); 
      border-color: rgba(255, 0, 128, 0.5);
    }
    .success { 
      background: rgba(0, 255, 136, 0.1); 
      border-color: rgba(0, 255, 136, 0.5);
    }
    button { 
      padding: 12px 24px; 
      margin: 8px; 
      cursor: pointer;
      background: linear-gradient(135deg, #00D9FF, #8000FF);
      color: white;
      border: none;
      border-radius: 6px;
      font-weight: 600;
      transition: all 0.3s ease;
    }
    button:hover {
      transform: translateY(-2px);
      box-shadow: 0 0 20px rgba(0, 217, 255, 0.4);
    }
    .sacred-icon {
      width: 40px;
      height: 40px;
      background: conic-gradient(from 45deg, #00D9FF, #0080FF, #8000FF, #00D9FF);
      border-radius: 50%;
      margin: 20px auto;
      animation: rotate 20s linear infinite;
    }
    @keyframes rotate {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    h1 { text-align: center; color: #00D9FF; }
    .emergency-title { color: #FF0080; text-align: center; }
  </style>
</head>
<body>
  <div class="sacred-icon"></div>
  <h1>🌌 HeadyConnection Systems</h1>
  <h2 class="emergency-title">🚨 Emergency Recovery Mode</h2>
  <div id="status"></div>
  
  <button onclick="testAPI()">Test API Connection</button>
  <button onclick="testMemory()">Test Memory System</button>
  <button onclick="testDrupal()">Test Drupal Integration</button>
  <button onclick="viewLogs()">View System Logs</button>
  <button onclick="runDiagnostics()">Run Full Diagnostics</button>
  
  <script>
    const API_BASE = window.location.protocol + '//' + window.location.host + '/api';
    
    function showStatus(message, type = 'error') {
      const div = document.createElement('div');
      div.className = 'status ' + type;
      div.textContent = message;
      document.getElementById('status').appendChild(div);
    }
    
    async function testAPI() {
      try {
        const res = await fetch(API_BASE + '/health');
        const data = await res.json();
        showStatus('✅ API Connected: ' + JSON.stringify(data), 'success');
      } catch (err) {
        showStatus('❌ API Error: ' + err.message, 'error');
      }
    }
    
    async function testMemory() {
      try {
        const res = await fetch(API_BASE + '/memory/count');
        const data = await res.json();
        showStatus('✅ Memory Count: ' + (data.count || 'unknown'), 'success');
      } catch (err) {
        showStatus('❌ Memory Error: ' + err.message, 'error');
      }
    }
    
    async function testDrupal() {
      try {
        const res = await fetch('/drupal-jsonapi/node');
        if (res.ok) {
          showStatus('✅ Drupal JSON:API accessible', 'success');
        } else {
          showStatus('❌ Drupal JSON:API not accessible', 'error');
        }
      } catch (err) {
        showStatus('❌ Drupal Error: ' + err.message, 'error');
      }
    }
    
    function viewLogs() {
      window.open('/logs', '_blank');
    }
    
    function runDiagnostics() {
      showStatus('🔄 Running comprehensive system diagnostics...', 'success');
      setTimeout(() => {
        testAPI();
        testMemory();
        testDrupal();
      }, 1000);
    }
    
    // Auto-test on load
    window.addEventListener('load', () => {
      showStatus('🌌 HeadyConnection Emergency Systems Online', 'success');
      showStatus('🔄 Running automatic diagnostics...', 'success');
      setTimeout(() => {
        testAPI();
        testMemory();
        testDrupal();
      }, 1000);
    });
  </script>
</body>
</html>`;

// Ensure public directory exists
if (!fs.existsSync('public')) {
  fs.mkdirSync('public', { recursive: true });
}

fs.writeFileSync('public/emergency.html', minimalHTML);
console.log('\n✅ Created public/emergency.html - Navigate to /emergency.html to test');
console.log('🌌 Sacred geometry theme applied');
```

### **🔥 STEP 3: MEMORY SYSTEM UNBLOCK (10 minutes)**
```javascript
// scripts/fix-memory-system.js
const fs = require('fs');
const path = require('path');

console.log('🧠 HEADING MEMORY SYSTEM DIAGNOSTIC\n');

// Find memory storage
const possiblePaths = [
  '.heady/memories.json',
  '.heady/learning-log.json',
  '.heady/cache/memories.db',
  'data/memories.json',
  'src/data/memories.json',
  'web/sites/default/files/memories.json'
];

let memoryFile = null;
for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    memoryFile = p;
    break;
  }
}

if (!memoryFile) {
  console.log('❌ Memory file not found. Creating default structure...');
  fs.mkdirSync('.heady', { recursive: true });
  const initialMemories = {
    version: "4.0.0",
    created: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    memories: [
      {
        id: "system-init",
        type: "system",
        content: "Heading memory system initialized",
        timestamp: new Date().toISOString(),
        metadata: {
          version: "4.0.0",
          system: "HeadyConnection"
        }
      }
    ]
  };
  fs.writeFileSync('.heady/memories.json', JSON.stringify(initialMemories, null, 2));
  memoryFile = '.heady/memories.json';
  console.log('✅ Created default memory file:', memoryFile);
}

console.log(`✅ Found memory file: ${memoryFile}`);

// Check file size and permissions
const stats = fs.statSync(memoryFile);
console.log(`📊 File size: ${stats.size} bytes`);
console.log(`📊 Last modified: ${stats.mtime}`);

// Read and analyze
try {
  const content = fs.readFileSync(memoryFile, 'utf8');
  const memoryData = JSON.parse(content);
  const memories = memoryData.memories || memoryData; // Handle both formats
  
  console.log(`\n📈 Memory Statistics:`);
  console.log(`  Total memories: ${memories.length}`);
  
  if (memories.length >= 150) {
    console.log(`\n⚠️  STUCK AT 150 - Checking for hardcoded limit...`);
    
    // Search for MAX_MEMORIES in code
    const codeFiles = require('glob') ? require('glob').sync('**/*.{js,ts}', { ignore: 'node_modules/**' }) : [];
    let limitFound = false;
    
    codeFiles.forEach(file => {
      try {
        const code = fs.readFileSync(file, 'utf8');
        if (code.match(/MAX.*MEMOR.*150/i) || code.match(/memories\.length.*>=.*150/)) {
          console.log(`  ❌ FOUND LIMIT IN: ${file}`);
          limitFound = true;
        }
      } catch (err) {
        // Skip files that can't be read
      }
    });
    
    if (!limitFound) {
      console.log(`  ✅ No hardcoded limit found`);
      console.log(`  ⚠️  Check: Database row limit, disk quota, or write permissions`);
    }
  }
  
  // Test write capability
  console.log(`\n🔧 Testing write capability...`);
  const testMemory = { 
    id: Date.now().toString(), 
    type: 'test', 
    content: 'write test - Heading memory system', 
    timestamp: new Date().toISOString(),
    metadata: {
      test: true,
      system: "HeadyConnection"
    }
  };
  memories.push(testMemory);
  
  // Update the file
  if (memoryData.memories) {
    memoryData.memories = memories;
    memoryData.lastUpdated = new Date().toISOString();
  } else {
    memoryData.lastUpdated = new Date().toISOString();
  }
  
  fs.writeFileSync(memoryFile, JSON.stringify(memoryData, null, 2));
  console.log(`✅ Write successful - removing test memory`);
  
  // Remove test memory
  memories.pop();
  if (memoryData.memories) {
    memoryData.memories = memories;
  }
  fs.writeFileSync(memoryFile, JSON.stringify(memoryData, null, 2));
  console.log(`✅ Memory system is HEALTHY and WRITABLE`);
  
} catch (err) {
  console.log(`❌ Error reading/parsing memory file: ${err.message}`);
  console.log(`ACTION: Backup and recreate the file`);
  fs.copyFileSync(memoryFile, memoryFile + '.backup.' + Date.now());
  
  // Create fresh memory file
  const freshMemories = {
    version: "4.0.0",
    created: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    memories: [
      {
        id: "system-recovery",
        type: "system",
        content: "Memory system recovered from error",
        timestamp: new Date().toISOString(),
        metadata: {
          error: err.message,
          recovered: true,
          system: "HeadyConnection"
        }
      }
    ]
  };
  fs.writeFileSync(memoryFile, JSON.stringify(freshMemories, null, 2));
  console.log(`✅ Memory system RECOVERED`);
}
```

---

## 🌐 **HYBRID DRUPAL 11 + MODERN STACK ARCHITECTURE**

### **🎯 CORE ARCHITECTURAL DECISIONS**

#### **✅ USE DRUPAL 11 FOR:**
- **Content-heavy sites**: Articles, programs, FAQs, resources, impact stories
- **Multi-page informational flows**: Documentation, knowledge bases
- **Editorial workflows**: Content approval, roles, permissions
- **Multilingual content**: Complex taxonomies, translations
- **"Create once, publish everywhere"**: Content distribution across frontends

#### **❌ DO NOT USE DRUPAL 11 FOR:**
- **Real-time applications**: Live collaboration, streaming dashboards
- **Low-latency transactions**: Matchmaking, billing, ML services
- **Single-page utilities**: Internal admin tools with minimal content
- **Heavy compute operations**: Data processing, analytics

#### **🔄 HYBRID INTEGRATION PATTERN:**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Drupal 11     │    │  React/Next.js  │    │  Microservices  │
│   (Content)     │◄──►│   (Frontend)    │◄──►│   (Logic)       │
│                 │    │                 │    │                 │
│ • Content Types │    │ • UI/UX         │    │ • Business Logic│
│ • Workflows     │    │ • Interactivity │    │ • APIs          │
│ • Permissions   │    │ • Real-time     │    │ • Processing    │
│ • Taxonomies    │    │ • Dashboards    │    │ • Integration   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   Cloudflare    │
                    │   (CDN/Security)│
                    └─────────────────┘
```

---

## 🔧 **TECHNICAL IMPLEMENTATION RULES**

### **🚫 FORBIDDEN PATTERNS (NEVER VIOLATE)**

#### **❌ NO LOCALHOST IN PRODUCTION**
```javascript
// ❌ WRONG - NEVER DO THIS
const API_URL = "http://localhost:3300";
const DRUPAL_URL = "http://localhost:8080";

// ✅ CORRECT - ALWAYS DO THIS
const API_URL = process.env.REACT_APP_API_URL || (() => {
  throw new Error('REACT_APP_API_URL must be set in production');
})();
const DRUPAL_URL = process.env.DRUPAL_URL || (() => {
  throw new Error('DRUPAL_URL must be set in production');
})();
```

#### **❌ NO ONRENDER DOMAIN REFERENCES**
```javascript
// ❌ WRONG - NEVER DO THIS
const PROD_URL = "https://heady-systems.onrender.com";

// ✅ CORRECT - USE CUSTOM DOMAINS
const PROD_URL = process.env.PROD_URL || "https://app.headyme.com";
```

#### **❌ NO EMPTY EVENT HANDLERS**
```jsx
// ❌ WRONG - BROKEN BUTTONS
<button onClick={() => {}}>Click me</button>
<a href="#">Link</a>

// ✅ CORRECT - FUNCTIONAL INTERFACES
<button onClick={handleSubmit} disabled={isLoading}>
  {isLoading ? 'Processing...' : 'Submit'}
</button>
<a href={url} onClick={handleNavigation}>Navigate</a>
```

### **✅ MANDATORY PATTERNS**

#### **🌐 ENVIRONMENT VARIABLE PROTOCOL**
```javascript
// .env.example (COMMIT TO REPO)
# API Configuration
REACT_APP_API_URL=https://api.headyme.com
DRUPAL_URL=https://cms.headyme.com
WS_URL=wss://api.headyme.com

# Feature Flags
ENABLE_ANALYTICS=false
DEBUG_MODE=false

# Memory System
MEMORY_DB_PATH=.heady/memories.json
MAX_MEMORY_SIZE_MB=100

# Drupal Configuration
DRUPAL_JSON_API_URL=https://cms.headyme.com/drupal-jsonapi
DRUPAL_AUTH_URL=https://cms.headyme.com/oauth/token
```

#### **🧠 MEMORY SYSTEM REQUIREMENTS**
```javascript
// ✅ NO HARDCODED LIMITS
const MAX_MEMORIES = parseInt(process.env.MAX_MEMORIES) || Infinity;

// ✅ STRUCTURED LOGGING
const logger = require('./utils/logger');

async function saveMemory(memory) {
  try {
    const result = await memoryDB.insert(memory);
    logger.info('Memory saved', { 
      id: memory.id, 
      type: memory.type,
      timestamp: new Date().toISOString()
    });
    return result;
  } catch (err) {
    logger.error('Memory save failed', { 
      error: err.message, 
      memory: { id: memory.id, type: memory.type }
    });
    throw new Error(`Memory system error: ${err.message}`);
  }
}
```

#### **🎨 SACRED GEOMETRY BRANDING**
```css
/* ✅ USE SACRED GEOMETRY THEME */
:root {
  --sacred-cyan: #00D9FF;
  --sacred-blue: #0080FF;
  --sacred-purple: #8000FF;
  --organic-gold: #FFD700;
  --organic-green: #00FF88;
  --bg-primary: #0A0A0F;
  --bg-secondary: #1A1A2E;
  --text-primary: #FFFFFF;
}

/* ❌ AVOID PINK - MINIMAL USAGE */
--accent-pink: #FF0080; /* Use sparingly only */
```

---

## 🛠️ **DRUPAL 11 IMPLEMENTATION**

### **📋 DRUPAL SETUP CHECKLIST**
```bash
# 1. Install Drupal 11
composer create-project drupal/recommended-project heady-drupal

# 2. Add essential modules
cd heady-drupal
composer require drush/drush
composer require drupal/jsonapi_extras
composer require drupal/oauth
composer require drupal/media_library
composer require drupal/layout_builder

# 3. Install Drupal
drush site:install standard --db-url=mysql://user:pass@localhost/db_name

# 4. Enable headless modules
drush en jsonapi jsonapi_extras oauth
drush en media_library layout_builder

# 5. Configure for headless
drush config:set jsonapi.settings read_only true
drush config:set jsonapi_extras.settings default_enabled true
```

### **🎯 DRUPAL CONTENT TYPES**
```yaml
# config/install/node.type.heady_program.yml
langcode: en
status: true
dependencies: { }
name: 'Heady Program'
type: heady_program
description: 'HeadyConnection programs and initiatives'
help: ''
new_revision: true
preview_mode: 1
display_submitted: true
```

### **🔌 DRUPAL API INTEGRATION**
```javascript
// services/drupal-api.js
class DrupalAPI {
  constructor(baseURL, oauthURL) {
    this.baseURL = baseURL;
    this.oauthURL = oauthURL;
    this.token = null;
  }

  async authenticate() {
    const response = await fetch(`${this.oauthURL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.DRUPAL_CLIENT_ID,
        client_secret: process.env.DRUPAL_CLIENT_SECRET
      })
    });
    
    const data = await response.json();
    this.token = data.access_token;
  }

  async getContent(contentType, filters = {}) {
    const params = new URLSearchParams({
      'filter[type]': contentType,
      ...filters
    });
    
    const response = await fetch(`${this.baseURL}/node?${params}`, {
      headers: { 'Authorization': `Bearer ${this.token}` }
    });
    
    return response.json();
  }
}

module.exports = new DrupalAPI(
  process.env.DRUPAL_JSON_API_URL,
  process.env.DRUPAL_AUTH_URL
);
```

---

## 🤖 **CODING AGENT BEHAVIOR RULES**

### **🚫 NEVER ASK USER ABOUT:**
- Creating files (ALWAYS create needed files)
- Installing dependencies (ALWAYS install required packages)
- Fixing errors (ALWAYS fix identified errors)
- Testing changes (ALWAYS test before claiming done)
- Configuration decisions (USE BEST PRACTICES)

### **✅ ONLY ASK USER ABOUT:**
- **Architecture decisions**: Database choice, framework selection
- **Business logic**: What should this feature do?
- **Destructive operations**: Delete database, remove critical files
- **External integrations**: API keys, third-party services

### **🔄 AUTOMATIC WORKFLOW**
```
1. IDENTIFY PROBLEM → Analyze symptoms
2. CHECK CODEBASE → Search for existing patterns
3. APPLY FIX → Implement solution automatically
4. TEST → Verify fix works
5. DOCUMENT → Update docs in same commit
6. LOG → Record what was changed
```

---

## 📊 **MONITORING & OBSERVABILITY**

### **🔍 HEALTH CHECK ENDPOINT**
```javascript
// routes/health.js
router.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      api: await checkAPI(),
      memory: await checkMemory(),
      drupal: await checkDrupal(),
      database: await checkDatabase()
    },
    branding: {
      sacredGeometry: true,
      minimalPink: true,
      customDomains: true
    }
  };
  
  const statusCode = health.services.api && health.services.memory ? 200 : 503;
  res.status(statusCode).json(health);
});
```

### **📝 STRUCTURED LOGGING**
```javascript
// utils/logger.js
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { 
    service: 'heady-connection',
    version: '4.0.0'
  },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console()
  ]
});
```

---

## 🎯 **SUCCESS CRITERIA**

### **✅ WEBSITES WORKING WHEN:**
- All pages load without console errors
- All buttons trigger intended actions  
- All links navigate correctly
- Sacred geometry theme applied consistently
- Zero localhost/onrender references in production

### **✅ MEMORY SYSTEM WORKING WHEN:**
- Memory count increases over time
- No hardcoded limits (150+ issue resolved)
- Logs show successful write operations
- Health endpoint reports memory system healthy

### **✅ DRUPAL INTEGRATION WORKING WHEN:**
- JSON:API endpoints accessible
- Content types defined and working
- OAuth authentication functional
- Frontend can consume Drupal content

### **✅ AGENT BEHAVIOR CORRECT WHEN:**
- No unnecessary questions asked
- Full solutions provided, not partial
- Automatic testing before claiming done
- Proper error handling and logging

---

## 🚨 **IMMEDIATE ACTION REQUIRED**

**PASTE THIS INTO YOUR CODING AGENT NOW:**

```
🚨 EMERGENCY PROTOCOL - EXECUTE IMMEDIATELY:

1. RUN DIAGNOSTIC SCRIPT (copy from STEP 1 above)
2. RUN FRONTEND FIX SCRIPT (copy from STEP 2 above)  
3. RUN MEMORY FIX SCRIPT (copy from STEP 3 above)
4. SHARE ALL OUTPUT WITH ME
5. DO NOT ASK IF YOU SHOULD DO THIS - EXECUTE NOW

REPORT BACK WITH:
- Diagnostic output
- Frontend fix results
- Memory system status
- Current website functionality
- Any localhost/onrender violations found
```

---

**🌌 HEADING CODING AGENT INSTRUCTIONS COMPLETE - VERSION 4.0**  
**🚨 EXECUTE EMERGENCY PROTOCOL IMMEDIATELY**  
**🎯 HYBRID DRUPAL 11 ARCHITECTURE DEFINED**  
**🧠 MEMORY SYSTEM UNBLOCK PROCEDURES READY**  
**🚫 ALL FORBIDDEN PATTERNS DOCUMENTED**
