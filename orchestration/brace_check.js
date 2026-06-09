const fs = require('fs');

function checkBraces() {
  const content = fs.readFileSync('orchestration/hcfp-runner.js', 'utf8');
  let line = 1;
  let col = 1;
  const stack = [];
  
  let i = 0;
  while (i < content.length) {
    const char = content[i];
    
    if (char === '\n') {
      line++;
      col = 1;
      i++;
      continue;
    }
    
    // Skip single line comment
    if (char === '/' && content[i + 1] === '/') {
      while (i < content.length && content[i] !== '\n') {
        i++;
      }
      continue;
    }
    
    // Skip multi line comment
    if (char === '/' && content[i + 1] === '*') {
      i += 2;
      while (i < content.length && !(content[i] === '*' && content[i + 1] === '/')) {
        if (content[i] === '\n') {
          line++;
          col = 1;
        } else {
          col++;
        }
        i++;
      }
      i += 2;
      continue;
    }
    
    // Skip single quote string
    if (char === "'") {
      i++;
      col++;
      while (i < content.length && content[i] !== "'") {
        if (content[i] === '\\') {
          i += 2;
          col += 2;
        } else {
          if (content[i] === '\n') {
            line++;
            col = 1;
          } else {
            col++;
          }
          i++;
        }
      }
      i++;
      col++;
      continue;
    }
    
    // Skip double quote string
    if (char === '"') {
      i++;
      col++;
      while (i < content.length && content[i] !== '"') {
        if (content[i] === '\\') {
          i += 2;
          col += 2;
        } else {
          if (content[i] === '\n') {
            line++;
            col = 1;
          } else {
            col++;
          }
          i++;
        }
      }
      i++;
      col++;
      continue;
    }
    
    // Skip template string
    if (char === '`') {
      i++;
      col++;
      while (i < content.length && content[i] !== '`') {
        if (content[i] === '\\') {
          i += 2;
          col += 2;
        } else {
          if (content[i] === '\n') {
            line++;
            col = 1;
          } else {
            col++;
          }
          i++;
        }
      }
      i++;
      col++;
      continue;
    }
    
    if (char === '{' || char === '(' || char === '[') {
      stack.push({ char, line, col });
    } else if (char === '}' || char === ')' || char === ']') {
      if (stack.length === 0) {
        console.log(`Unmatched closing char [${char}] at line ${line}, col ${col}`);
      } else {
        const top = stack.pop();
        if ((char === '}' && top.char !== '{') || 
            (char === ')' && top.char !== '(') || 
            (char === ']' && top.char !== '[')) {
          console.log(`Mismatched pair: top [${top.char}] at line ${top.line}, col ${top.col} with closing [${char}] at line ${line}, col ${col}`);
          console.log('Current Stack:', stack.slice(-5));
        }
      }
    }
    i++;
    col++;
  }
  
  if (stack.length > 0) {
    console.log('Unclosed opening chars at end:', stack.slice(-10));
  } else {
    console.log('Check completed!');
  }
}

checkBraces();
