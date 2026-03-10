const fs = require('fs');
const glob = require('glob');
const path = require('path');

function fixLocalStorage(directory) {
  const exts = ['.js', '.html', '.jsx', '.ts', '.tsx'];
  
  const walk = (dir) => {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    try {
        const list = fs.readdirSync(dir);
        list.forEach((file) => {
          file = path.join(dir, file);
          try {
              const stat = fs.statSync(file);
              if (stat && stat.isDirectory() && !file.includes('node_modules') && !file.includes('.git') && !file.includes('AndroidSDK')) {
                results = results.concat(walk(file));
              } else {
                if (exts.some(ext => file.endsWith(ext))) {
                  results.push(file);
                }
              }
          } catch(e) {}
        });
    } catch(e) {}
    return results;
  };

  const allFiles = walk(directory);
  let changed = 0;

  allFiles.forEach(file => {
    try {
        let content = fs.readFileSync(file, 'utf8');
        let original = content;

        // Never use localStorage for session tokens.
        if (content.includes('localStorage.setItem(\'token') || content.includes('localStorage.setItem("token')) {
          content = content.replace(/localStorage\.setItem\((['"])token\1\s*,\s*(.*?)\)/g, "document.cookie = 'token=' + $2 + '; path=/; Secure; HttpOnly; SameSite=Strict'");
          content = content.replace(/localStorage\.getItem\((['"])token\1\)/g, "(document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1] || null)");
          content = content.replace(/localStorage\.removeItem\((['"])token\1\)/g, "document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; Secure; HttpOnly; SameSite=Strict'");
        }

        // Remove console.log and replace with logger.info
        if (file.includes('services/') && content.includes('console.log')) {
          // This is a simplified replacement. Real systems would use a proper AST parser.
          // content = content.replace(/console\.log/g, 'logger.info');
        }

        // Replace boolean logic with CSL gates in critical places.
        // e.g. "if (isTrue) {" -> "if (cslGate(0.618)) {"
        // Since we cannot blindly replace all if statements, we'll look for specific patterns

        if (content !== original) {
          fs.writeFileSync(file, content);
          changed++;
          console.log(`Secured Cookies: ${file}`);
        }
    } catch(e) {}
  });
  console.log(`Total cookie files updated: ${changed}`);
}

fixLocalStorage('.');
