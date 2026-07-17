require('dotenv').config();
const { AutoSuccessEngine } = require('./src/hc_auto_success');

async function run() {
    console.log("Starting AutoSuccessEngine test...");
    const engine = new AutoSuccessEngine();
    
    // Check if LINEAR_API_KEY is available
    if (!process.env.LINEAR_API_KEY) {
        console.warn("WARNING: LINEAR_API_KEY is not set in environment.");
    } else {
        console.log("LINEAR_API_KEY found, length:", process.env.LINEAR_API_KEY.length);
    }
    
    // Find the task
    const task = { id: 'intel-011' };
    if (!task) {
        console.error("Task intel-011 not found in TASK_CATALOG");
        process.exit(1);
    }
    
    console.log("Found task:", task.name);
    
    try {
        console.log("Executing task directly...");
        const result = await engine._performWork(task);
        console.log("Task executed. Result:");
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error("Task failed:", error);
    }
    
    console.log("Test complete.");
    process.exit(0);
}

run();
