import React, { useState, useEffect } from 'react';
import './styles.css';

// Mock schema data if none provided
const mockSchema = {
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

const Node = ({ node }) => {
  const modality = node.csl_constraints?.modality || 'text';
  return (
    <div 
      className="resonance-node" 
      style={{ left: node.x, top: node.y }}
      title={`Agent: ${node.agent}`}
    >
      <div className="node-header">
        <span className="node-title">{node.id}</span>
        <span className={`modality-badge modality-${modality}`}>{modality}</span>
      </div>
      <div className="node-body">
        <div>Agent: <b>{node.agent}</b></div>
        {node.model && <div className="model-tag">{node.model}</div>}
      </div>
    </div>
  );
};

const Edge = ({ start, end, condition }) => {
  if (!start || !end) return null;
  
  // Calculate line dimensions
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  
  // Adjust starting point to be roughly middle of nodes (node width ~260, height ~100)
  const x = start.x + 130;
  const y = start.y + 50;

  return (
    <div 
      className="csl-edge"
      style={{
        left: x,
        top: y,
        width: length,
        transform: `rotate(${angle}deg)`
      }}
    >
      <div className="edge-label" style={{ transform: `translateX(-50%) rotate(${-angle}deg)` }}>
        {condition.length > 30 ? condition.substring(0, 30) + '...' : condition}
      </div>
    </div>
  );
};

export default function ResonanceCanvas({ schema = mockSchema }) {
  const [magicInput, setMagicInput] = useState('');
  const [activeSchema, setActiveSchema] = useState(schema);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleMagicGenerate = () => {
    if (!magicInput.trim()) return;
    setIsGenerating(true);
    
    // Simulate API call to schema-generator
    setTimeout(() => {
      // Very basic structural simulation for demo purposes
      setActiveSchema(mockSchema); // Resets to mock for now
      setIsGenerating(false);
      setMagicInput('');
    }, 1200);
  };

  return (
    <div className="resonance-canvas-wrapper">
      <div className="canvas-header">
        <div className="canvas-header-top">
          <h1>Heady™ Resonance Canvas</h1>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>
            Latent OS Orchestration
          </div>
        </div>
        
        {/* Layer 5: Magic Input */}
        <div className="magic-input-container">
          <input 
            type="text" 
            className="magic-input" 
            placeholder="Describe your intent... (e.g., 'Analyze this image and generate React code')"
            value={magicInput}
            onChange={(e) => setMagicInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleMagicGenerate()}
          />
          <button className="btn-magic" onClick={handleMagicGenerate} disabled={isGenerating}>
            {isGenerating ? 'Synthesizing...' : 'Generate Workflow'}
          </button>
        </div>
      </div>

      {/* Layer 3: The Graph Canvas */}
      <div className="canvas-container">
        {/* Render Edges first so they are behind nodes */}
        {activeSchema.csl_edges.map((edge, idx) => {
          const startNode = activeSchema.nodes.find(n => n.id === edge.from);
          const endNode = activeSchema.nodes.find(n => n.id === edge.to);
          return <Edge key={idx} start={startNode} end={endNode} condition={edge.condition} />;
        })}

        {/* Render Nodes */}
        {activeSchema.nodes.map(node => (
          <Node key={node.id} node={node} />
        ))}
      </div>
    </div>
  );
}
