const testSchema = {
    workflow_id: 'magic_workflow',
    nodes: [
        { id: 'input_ingestion', agent: 'heady_router_bee', csl_constraints: { modality: 'text' }, x: 50, y: 150 },
        { id: 'vision_analysis', agent: 'heady_vision_bee', csl_constraints: { modality: 'vision' }, x: 350, y: 50 },
        { id: 'code_generation', agent: 'heady_coder_bee', model: 'claude-3-opus', csl_constraints: { modality: 'coding' }, x: 350, y: 250 },
        { id: 'final_synthesis', agent: 'heady_synthesis_bee', csl_constraints: { modality: 'text' }, x: 650, y: 150 }
    ],
    csl_edges: [
        { from: 'input_ingestion', to: 'vision_analysis', condition: { description: 'Trigger when image data is present.' } },
        { from: 'input_ingestion', to: 'code_generation', condition: { description: 'Trigger when code writing is required.' } },
        { from: 'vision_analysis', to: 'final_synthesis', condition: { description: 'Trigger when analysis completes.' } },
        { from: 'code_generation', to: 'final_synthesis', condition: { description: 'Trigger when code is generated.' } }
    ]
};

async function runTest() {
    try {
        console.log('Testing Heady Orchestrator Tool...');
        const mod = await import('../src/mcp/tools/heady-orchestrator-tool.js');

        console.log('\n--- Validating Schema ---');
        const validateResponse = await mod.handleHeadyOrchestrator({
            action: 'validate',
            schema: testSchema
        });
        console.log('Validation Response:', JSON.stringify(validateResponse, null, 2));

        console.log('\n--- Executing Schema ---');
        const executeResponse = await mod.handleHeadyOrchestrator({
            action: 'execute',
            schema: testSchema,
            input_context: "Analyze the attached architecture diagram and output a React component. [deepseek-v3 LIVE RESPONSE]"
        });
        console.log('Execution Result:', JSON.stringify(executeResponse, null, 2));

    } catch (e) {
        console.error('Test failed:', e);
    }
}

runTest();
