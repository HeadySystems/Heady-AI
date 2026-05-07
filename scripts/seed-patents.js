#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { engine: computeEngine } = require('../mcp-servers/heady-compute-mcp-server');
const { getLog } = require('../src/kernel');

const logger = getLog('patent-seeder');

async function seedPatents() {
  logger.info('Starting patent vector seeding process...');
  const registryPath = path.join(__dirname, '../configs/patent-registry-standardized.yaml');
  
  if (!fs.existsSync(registryPath)) {
    logger.error('Patent registry not found at ' + registryPath);
    process.exit(1);
  }

  const doc = yaml.load(fs.readFileSync(registryPath, 'utf8'));
  let totalPatents = [];

  // Extract batch 4
  if (doc.batch_4_patents) totalPatents.push(...doc.batch_4_patents);
  
  // Extract march 2026 batch
  if (doc.march_2026_batch) totalPatents.push(...doc.march_2026_batch);

  // Extract foundational portfolio
  if (doc.foundational_patents) {
    for (const [category, patents] of Object.entries(doc.foundational_patents)) {
      if (Array.isArray(patents)) {
        totalPatents.push(...patents.map(p => ({ ...p, foundation_category: category })));
      }
    }
  }

  logger.info(`Found ${totalPatents.length} patents in registry to seed.`);

  let successCount = 0;
  for (const patent of totalPatents) {
    try {
      const text = `${patent.title}. ${patent.claims_summary || ''}. Domain: ${patent.domain || 'Core'}. Category: ${patent.category || 'software'}`;
      
      // 1. Embed patent text
      const embedRes = await computeEngine.embed(text);
      
      // 2. Upsert vector
      await computeEngine.vectorUpsert(patent.id, embedRes.vector, {
        title: patent.title,
        domain: patent.domain,
        category: patent.category,
        is_foundational: !!patent.foundation_category
      });
      
      successCount++;
      if (successCount % 10 === 0) {
        logger.info(`Seeded ${successCount}/${totalPatents.length} patents...`);
      }
    } catch (err) {
      logger.error(`Failed to seed patent ${patent.id}: ${err.message}`);
    }
  }

  logger.info(`Patent vector seeding complete. Successfully seeded ${successCount} vectors.`);
}

seedPatents().catch(err => {
  logger.error('Unhandled error during seeding: ' + err.message);
  process.exit(1);
});
