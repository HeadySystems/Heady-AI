const fs = require('fs');
const path = require('path');

const dropzoneDir = '/home/headyme/Heady/dropzone/06-Skills-Library';
const destSkillsDir = '/home/headyme/Heady-AI/.agents/skills';
const destWorkflowsDir = '/home/headyme/Heady-AI/.agents/workflows';

const PREAMBLE = `> **OPTIMAL BUILD NOTICE:** This file has been auto-migrated for the Heady-AI Latent OS (v2.0.0).
> - **Package Manager:** Use \`pnpm\` and \`Turborepo\`
> - **Frontend:** Vite SPAs + Vanilla Web Components (React only for complex canvas)
> - **Event Bus:** NATS (\`heady-event-bus\`)
> - **Sandbox:** WASM WebContainers
> - **UI Sync:** Server-Sent Events (SSE) + HTTP/2
> - **Vector Trigger:** Merkle-Tree File Hashing
> - **Rule File:** Follow \`AGENTS.md\`\n\n`;

function transformContent(content) {
  let newContent = content;
  // Safe string replacements
  newContent = newContent.replace(/\/home\/headyme\/Heady(?!\-AI)/g, '/home/headyme/Heady-AI');
  newContent = newContent.replace(/npm install/g, 'pnpm install');
  newContent = newContent.replace(/npm run/g, 'pnpm run');
  newContent = newContent.replace(/npm i /g, 'pnpm add ');
  newContent = newContent.replace(/npx turbo/g, 'pnpm turbo');
  newContent = newContent.replace(/npm audit/g, 'pnpm audit');
  
  return PREAMBLE + newContent;
}

// 1. Process New Skills from Dropzone
if (fs.existsSync(dropzoneDir)) {
  const files = fs.readdirSync(dropzoneDir);
  for (const file of files) {
    if (!file.endsWith('.md') || file === 'MANIFEST.md' || file === 'NEW-SKILLS-SUMMARY.md' || file === 'SKILL.md') {
      continue;
    }
    
    // Determine skill name
    let skillName = file.replace('.md', '');
    // Remove leading numbers e.g. "23-heady-arena-productization" -> "heady-arena-productization"
    skillName = skillName.replace(/^\d+-/, '');
    // Remove trailing "-SKILL" if it exists
    skillName = skillName.replace(/-SKILL$/, '');

    const srcPath = path.join(dropzoneDir, file);
    const content = fs.readFileSync(srcPath, 'utf8');
    
    const transformed = transformContent(content);
    
    const targetDir = path.join(destSkillsDir, skillName);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    fs.writeFileSync(path.join(targetDir, 'SKILL.md'), transformed);
    console.log(`Migrated skill: ${skillName}`);
  }
}

// 2. Process Existing Workflows
if (fs.existsSync(destWorkflowsDir)) {
  const workflows = fs.readdirSync(destWorkflowsDir);
  for (const file of workflows) {
    if (!file.endsWith('.md')) continue;
    
    const filePath = path.join(destWorkflowsDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Only prepend if not already migrated
    if (!content.includes('OPTIMAL BUILD NOTICE')) {
      const transformed = transformContent(content);
      fs.writeFileSync(filePath, transformed);
      console.log(`Migrated workflow: ${file}`);
    }
  }
}

// 3. Process Existing Skills (just adding the preamble and replacing npm/Heady paths)
if (fs.existsSync(destSkillsDir)) {
    const dirs = fs.readdirSync(destSkillsDir);
    for (const dir of dirs) {
        const skillPath = path.join(destSkillsDir, dir, 'SKILL.md');
        if (fs.existsSync(skillPath)) {
            const content = fs.readFileSync(skillPath, 'utf8');
            if (!content.includes('OPTIMAL BUILD NOTICE')) {
                const transformed = transformContent(content);
                fs.writeFileSync(skillPath, transformed);
                console.log(`Updated existing skill: ${dir}`);
            }
        }
    }
}

console.log('Migration completed successfully.');
