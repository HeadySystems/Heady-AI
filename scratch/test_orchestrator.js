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
                { id: 'biometric_vision', agent: 'heady_vision_bee' },
                { id: 'compliance_logic', agent: 'heady_audit_bee' }
            ],
            csl_edges: [
                {
                    from: 'biometric_vision',
                    to: 'compliance_logic',
                    condition: {
                        description: 'Trigger when biometric age verification returns uncertain or underage results.',
                        gate_threshold: 'CSL_THRESHOLDS.HIGH'
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
            input_context: 'Biometric scan complete. User appears to be 19. Uncertainty high.'
        });
        console.log('Execution Result:', JSON.stringify(execResult, null, 2));

    } catch (e) {
        console.error('Test failed:');
        console.error(e);
    }
}

test();
