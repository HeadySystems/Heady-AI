const fs = require('fs');

const path = 'heady-manager.js';
if (fs.existsSync(path)) {
  let content = fs.readFileSync(path, 'utf8');
  if (content.includes('Eric Head')) {
    content = content.replace(/Eric Head/g, 'Eric Haywood');
    fs.writeFileSync(path, content);
    console.log('Updated founder name in heady-manager.js');
  }
}
