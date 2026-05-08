<script>
    import './styles.css';

    // Mock schema data
    export let schema = {
        workflow_id: 'magic_workflow',
        nodes: [
            { id: 'input_ingestion', agent: 'heady_router_bee', csl_constraints: { modality: 'text' }, x: 50, y: 150 },
            { id: 'vision_analysis', agent: 'heady_vision_bee', csl_constraints: { modality: 'vision' }, x: 350, y: 50 },
            { id: 'code_generation', agent: 'heady_coder_bee', model: 'claude-3-opus', csl_constraints: { modality: 'coding' }, x: 350, y: 250 },
            { id: 'final_synthesis', agent: 'heady_synthesis_bee', csl_constraints: { modality: 'text' }, x: 650, y: 150 }
        ],
        csl_edges: [
            { from: 'input_ingestion', to: 'vision_analysis', condition: 'Trigger when image data is present.' },
            { from: 'input_ingestion', to: 'code_generation', condition: 'Trigger when code writing is required.' },
            { from: 'vision_analysis', to: 'final_synthesis', condition: 'Trigger when analysis completes.' },
            { from: 'code_generation', to: 'final_synthesis', condition: 'Trigger when code is generated.' }
        ]
    };

    let magicInput = '';
    let activeSchema = schema;
    let isGenerating = false;

    function handleMagicGenerate() {
        if (!magicInput.trim()) return;
        isGenerating = true;
        
        // Simulate API call to schema-generator
        setTimeout(() => {
            activeSchema = schema; // Reset to mock for now
            isGenerating = false;
            magicInput = '';
        }, 1200);
    }

    function calculateEdgeStyles(start, end) {
        if (!start || !end) return { width: 0, angle: 0, x: 0, y: 0 };
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        const x = start.x + 130;
        const y = start.y + 50;
        return { length, angle, x, y };
    }
</script>

<div class="resonance-canvas-wrapper">
    <div class="canvas-header">
        <div class="canvas-header-top">
            <h1>Heady™ Resonance Canvas</h1>
            <div style="color: rgba(255,255,255,0.5); font-size: 0.8rem;">
                Latent OS Orchestration (Powered by Svelte)
            </div>
        </div>
        
        <!-- Layer 5: Magic Input -->
        <div class="magic-input-container">
            <input 
                type="text" 
                class="magic-input" 
                placeholder="Describe your intent... (e.g., 'Analyze this image and generate React code')"
                bind:value={magicInput}
                on:keydown={(e) => e.key === 'Enter' && handleMagicGenerate()}
            />
            <button class="btn-magic" on:click={handleMagicGenerate} disabled={isGenerating}>
                {isGenerating ? 'Synthesizing...' : 'Generate Workflow'}
            </button>
        </div>
    </div>

    <!-- Layer 3: The Graph Canvas -->
    <div class="canvas-container">
        <!-- Render Edges -->
        {#each activeSchema.csl_edges as edge}
            {@const startNode = activeSchema.nodes.find(n => n.id === edge.from)}
            {@const endNode = activeSchema.nodes.find(n => n.id === edge.to)}
            {@const styles = calculateEdgeStyles(startNode, endNode)}
            
            <div 
                class="csl-edge"
                style="left: {styles.x}px; top: {styles.y}px; width: {styles.length}px; transform: rotate({styles.angle}deg);"
            >
                <div class="edge-label" style="transform: translateX(-50%) rotate(-{styles.angle}deg);">
                    {edge.condition.length > 30 ? edge.condition.substring(0, 30) + '...' : edge.condition}
                </div>
            </div>
        {/each}

        <!-- Render Nodes -->
        {#each activeSchema.nodes as node (node.id)}
            {@const modality = node.csl_constraints?.modality || 'text'}
            <div 
                class="resonance-node" 
                style="left: {node.x}px; top: {node.y}px;"
                title="Agent: {node.agent}"
            >
                <div class="node-header">
                    <span class="node-title">{node.id}</span>
                    <span class="modality-badge modality-{modality}">{modality}</span>
                </div>
                <div class="node-body">
                    <div>Agent: <b>{node.agent}</b></div>
                    {#if node.model}
                        <div class="model-tag">{node.model}</div>
                    {/if}
                </div>
            </div>
        {/each}
    </div>
</div>
