const path = require('path');

async function test() {
    try {
        console.log('Testing Heady Orchestrator Tool...');
        
        // Load the handler
        const { handler } = require('../src/mcp/tools/heady-orchestrator-tool.js');
        
        // Define a test Resonance Schema
        const schema = {
            workflow_id: 'test_kiosk_compliance',
            nodes: [
                { 
                    id: 'biometric_vision', 
                    agent: 'heady_vision_bee',
                    csl_constraints: { modality: 'vision' }
                },
                { 
                    id: 'compliance_logic', 
                    agent: 'heady_audit_bee',
                    model: 'claude-3-opus' // Explicit model request
                }
            ],
            csl_edges: [
                {
                    from: 'biometric_vision',
                    to: 'compliance_logic',
                    condition: {
                        description: '[gemini-2.5-pro VISION ANALYSIS]: Identified 3 key visual elements in the input. Confidence: High.',
                        gate_threshold: 'CSL_THRESHOLDS.LOW'
                    }
                }
            ]
        };

        console.log('\n--- Validating Schema ---');
        const validResult = await handler({
            action: 'validate',
            schema
        });
        console.log('Validation Result:', validResult);

        console.log('\n--- Executing Schema ---');
        const execResult = await handler({
            action: 'execute',
            schema,
            input_context: 'Trigger when biometric age verification returns uncertain or underage results.'
        });
        console.log('Execution Result:', JSON.stringify(execResult, null, 2));

    } catch (e) {
        console.error('Test failed:');
        console.error(e);
    }
}

test();
