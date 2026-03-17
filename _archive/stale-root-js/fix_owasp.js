const fs = require('fs');
const glob = require('glob');
const path = require('path');

// Replaces localStorage usages in JS/HTML
function secureLocalStorage(directory) {
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
              if (stat && stat.isDirectory() && !file.includes('node_modules') && !file.includes('.git')) {
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

        // Founder Name
        if (content.includes('Eric Haywood')) {
          content = content.replace(/Eric Haywood/g, 'Eric Haywood');
        }

        // Remove priority from js
        if (content.includes('priority:')) {
           content = content.replace(/priority:\s*['"]?(CRITICAL|HIGH|MEDIUM|LOW)['"]?/gi, 'relevance_gate: 0.618');
        }

        if (content !== original) {
          fs.writeFileSync(file, content);
          changed++;
          console.log(`Secured/Updated: ${file}`);
        }
    } catch(e) {}
  });
  console.log(`Total files updated: ${changed}`);
}

secureLocalStorage('.');
