// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: scripts/validate-branding.js                                                    ║
// ║  LAYER: automation                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const axios = require('axios');
const config = yaml.load(fs.readFileSync(path.join(__dirname, '..', 'configs', 'branding', 'branding-standards.yaml'), 'utf8'));

module.exports = { validateBranding, getAllProjectFiles };

async function validateBranding() {
  const testResults = [];
  
  // Check file headers in the project
  const projectFiles = getAllProjectFiles();
  for (const file of projectFiles) {
    const content = fs.readFileSync(file, 'utf8');
    
    if (!content.includes('HEADY_BRAND:BEGIN')) {
      testResults.push({ 
        file, 
        check: 'branding-header', 
        passed: false,
        message: 'Missing branding header'
      });
    }
    
    if (!content.includes('HEADY_BRAND:END')) {
      testResults.push({ 
        file, 
        check: 'branding-footer', 
        passed: false,
        message: 'Missing branding footer'
      });
    }
  }
  
  // Return violations (caller decides whether to exit)
  const failures = testResults.filter(r => !r.passed);
  if (failures.length > 0) {
    return failures;
  }
  
  return [];
}

function getAllProjectFiles() {
  const ignoreDirs = ['node_modules', 'dist', 'build', '.git', '.husky', '.venv', 'venv', 'AndroidSDK', 'gradle', 'nginx', 'ventoy', '.wrangler', 'lfs', '__pycache__', 'cmake', 'nasm', 'tools', 'platform-tools'];
  const files = [];
  
  function walk(dir) {
    let list;
    try {
      list = fs.readdirSync(dir);
    } catch (err) {
      return;
    }
    
    list.forEach(f => {
      const fullPath = path.join(dir, f);
      if (ignoreDirs.some(d => fullPath.includes(d))) return;
      
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          walk(fullPath);
        } else if (/\.([jt]sx?|py|ya?ml|json|xml|ps1|conf|txt|md)$/i.test(fullPath)) {
          files.push(fullPath);
        }
      } catch (err) {
        // Skip files that cannot be read/stated (e.g. broken symlinks)
      }
    });
  }
  
  walk(process.cwd());
  return files;
}

