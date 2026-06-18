import fs from 'fs';
import path from 'path';
import { input, select, checkbox } from '@inquirer/prompts';
import chalk from 'chalk';

console.log(chalk.cyan('\n============================================='));
console.log(chalk.cyan('∞ Heady Understanding Engine (HUE) Wizard ∞'));
console.log(chalk.cyan('=============================================\n'));

async function runWizard() {
  // 1. Subject Input
  const subject = await input({ 
    message: 'What is the Subject of this understanding report? (e.g., Component, Decision, PR)',
    validate: (value) => value.trim().length > 0 ? true : 'Subject cannot be empty'
  });

  // 2. Cynefin Classification Dropdown
  const cynefinClass = await select({
    message: 'Classify the domain of this subject (Cynefin framework):',
    choices: [
      { name: 'Clear (Best practices, predictable)', value: 'clear' },
      { name: 'Complicated (Good practices, requires expert analysis)', value: 'complicated' },
      { name: 'Complex (Emergent practices, unpredictable)', value: 'complex' },
      { name: 'Chaotic (Novel practices, crisis management)', value: 'chaotic' }
    ]
  });

  // 3. Data Injection Menus
  const dataToInject = await checkbox({
    message: 'Select the data contexts to inject into the analysis:',
    choices: [
      { name: 'Coherence Map / System Architecture', value: 'coherence_map', checked: true },
      { name: 'Recent Git History / PR Commits', value: 'git_history' },
      { name: 'Vector Memory Embeddings', value: 'vector_memory' },
      { name: 'Tracer-Bee Execution Logs', value: 'tracer_logs' },
      { name: 'Environment Variables / Config', value: 'env_config' }
    ]
  });

  // 4. Lens Selection
  const lensesToRun = await checkbox({
    message: 'Select which lenses of the schema to execute:',
    choices: [
      { name: 'L1: Mechanism (How it works)', value: 'mechanism', checked: true },
      { name: 'L2: Causality (Why it is possible)', value: 'causality', checked: true },
      { name: 'L3: Teleology (Purpose)', value: 'teleology', checked: true },
      { name: 'L4: Relations (Upstream/Downstream)', value: 'relations', checked: true },
      { name: 'L5: Effect (Internal/External)', value: 'effect', checked: true },
      { name: 'L6: Blast Radius (Significance)', value: 'blastRadius', checked: true },
      { name: 'L7: Normativity (Good/Bad/Trade-offs)', value: 'normativity', checked: true },
      { name: 'L8: Agency (Intelligence level)', value: 'agency', checked: true },
      { name: 'L9: Confidence (CSL Level)', value: 'evidence', checked: true },
      { name: 'L10: Execution & Evolution (Intent vs Reality, Options, Parameters)', value: 'evolution', checked: true }
    ]
  });

  console.log(chalk.yellow('\nScaffolding the Custom Understanding Artifact...\n'));

  // Scaffold the JSON Block
  const jsonLensBlock = {};
  lensesToRun.forEach(lens => {
    jsonLensBlock[lens] = "pending analysis...";
  });

  const uaJson = {
    subject: subject,
    class: cynefinClass,
    injectedContext: dataToInject,
    lenses: jsonLensBlock,
    overallConfidence: "pending",
    openUnknowns: [],
    embedding: "vec(384)",
    revalidatedAt: new Date().toISOString(),
    trace: `heady.understanding.${subject.replace(/\s+/g, '-').toLowerCase()}`
  };

  const markdownOutput = `# Understanding Report: ${subject}

## Executive Summary
*Context Injected: ${dataToInject.join(', ')}*
*Domain Classification: ${cynefinClass}*

## Analysis Lenses
${lensesToRun.map(l => `### ${l.toUpperCase()}\n*Pending agent analysis...*\n`).join('\n')}

## Formal Understanding Artifact (UA)
\`\`\`jsonc
${JSON.stringify(uaJson, null, 2)}
\`\`\`
`;

  const filename = `understanding_report_${subject.replace(/\s+/g, '_').toLowerCase()}.md`;
  const filepath = path.join(process.cwd(), filename);
  
  fs.writeFileSync(filepath, markdownOutput);

  console.log(chalk.green(`✔ Success! Generated custom template at:`));
  console.log(chalk.white(filepath));
  console.log(chalk.cyan(`\nYou can now hand this file to HeadyBuddy or /heady-autopilot to fill out the technical details based on the injected context.`));
}

runWizard().catch(err => {
  console.error(chalk.red('Error running wizard:'), err);
});
