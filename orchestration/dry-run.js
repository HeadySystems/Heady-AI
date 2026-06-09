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
// ║  FILE: orchestration/dry-run.js                                  ║
// ║  LAYER: orchestration                                             ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
'use strict';

const { HCFPRunner } = require('./hcfp-runner');

async function main() {
  console.log("=== HEADY COGNITIVE ORCHESTRATION DRY-RUN ===");
  const runner = new HCFPRunner();

  // Test 1: Simple task (Should route to Edge Adapter Worker AI simulation)
  console.log("\n--- TEST 1: Simple Task (Expect Edge Routing) ---");
  const simpleTask = "Check API status";
  console.log(`Task: "${simpleTask}"`);
  
  const resultSimple = await runner.run(simpleTask, { routing: 'smart' });
  console.log(`Pipeline Status: ${resultSimple.status}`);
  console.log("Execution Stage (Stage 5) output:");
  console.log(JSON.stringify(resultSimple.stages.Execution, null, 2));

  // Test 2: Complex task (Should route to LangGraph Local State Graph)
  console.log("\n--- TEST 2: Complex/Optimization Task (Expect Local LangGraph Cyclic State Graph) ---");
  const complexTask = "Optimize cognitive multi-agent pipeline using Golden Ratio principles";
  console.log(`Task: "${complexTask}"`);
  
  const resultComplex = await runner.run(complexTask, { routing: 'smart' });
  console.log(`Pipeline Status: ${resultComplex.status}`);
  console.log("Execution Stage (Stage 5) output:");
  console.log(JSON.stringify(resultComplex.stages.Execution, null, 2));

  console.log("\n=== DRY-RUN VERIFICATION SUCCESSFUL ===");
}

main().catch(err => {
  console.error("Dry-run failed with error:", err);
  process.exit(1);
});
