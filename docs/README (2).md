# Heady Continuous Semantic Logic (CSL) Transform

## Overview
Complete transformation system for converting traditional boolean if/else logic into continuous semantic logic gates using fuzzy logic operators.

## Architecture Components

### 1. Core Runtime (`packages/heady-semantic-logic/`)
- **TypeScript SDK**: Full fuzzy logic gate implementation with truth values, membership functions, rule engine
- **Python SDK**: Python equivalent for HeadyBrain/Orchestrator services
- **T-Norm Families**: Zadeh (min/max), Product (multiplicative), Łukasiewicz (bounded)

### 2. Transformation Pipeline
- **AST Scanner**: Detects if/else, switch, ternary, &&/|| patterns using ts-morph
- **Pattern Matcher**: Classifies into 14 canonical forms (BINARY_BRANCH, COMPOUND_AND, RANGE_CHECK, etc.)
- **Logic Mapper**: Generates semantic IR from patterns
- **Code Generator**: Emits transformed TypeScript/JavaScript with CSL gates

### 3. Integration Adapters
- **HeadyBrain**: Decision-making with continuous constraints/preferences
- **HeadyConductor**: Health monitoring with fuzzy system metrics
- **HeadyBattle**: Validation gates for quality assurance
- **MonorepoSync**: Projects changes back to dev repos via git branches

### 4. Embedding-Based Alternative
- **Vector Semantic Gates**: Uses cosine similarity of embeddings as truth values
- **Monte Carlo Branching**: Probabilistic routing based on semantic weights
- Integrates with your existing 3D vector memory at headyme.com

## Quick Start

### Installation
```bash
cd packages/heady-semantic-logic
pnpm install
pnpm build
```

### CLI Usage
```bash
# Scan your codebase for transformable patterns
heady-semantic scan "src/**/*.ts" --output-dir ./transformed

# Run transformation with dry-run
heady-semantic transform "src/**/*.ts" --dry-run --report

# Full transform and sync to monorepo
heady-semantic transform "src/**/*.ts" --output-dir ./semantic-proj
./scripts/sync_to_monorepo.sh ../HeadyMe ./semantic-proj
```

### Programmatic Usage
```typescript
import { SemanticTransformer } from '@headysystems/semantic-logic';

const transformer = new SemanticTransformer({
  include: ['src/**/*.ts'],
  outputDir: './transformed',
  defaultTNorm: 'product',
  sideBySide: true,
  generateReport: true,
});

const result = await transformer.transform();
console.log(`Transformed ${result.generatedFiles.length} files`);
```

## Examples

### Before (Traditional Boolean Logic)
```typescript
if (cpuUsage > 80 && errorRate > 0.1) {
  scaleUp();
} else if (cpuUsage > 60 || queueDepth > 100) {
  rebalance();
} else {
  maintain();
}
```

### After (Continuous Semantic Logic)
```typescript
import { AND, OR, truthValue, sigmoid } from '@headysystems/semantic-logic';

// Fuzzify crisp inputs
const cpuHigh = sigmoid(80, 0.1, 'cpu_high').evaluate(cpuUsage);
const errorsElevated = sigmoid(0.1, 50, 'errors').evaluate(errorRate);
const cpuModerate = sigmoid(60, 0.1, 'cpu_mod').evaluate(cpuUsage);
const queueDeep = sigmoid(100, 0.05, 'queue').evaluate(queueDepth);

// Continuous gate evaluation
const scaleUpGate = AND([
  truthValue(cpuHigh),
  truthValue(errorsElevated)
], { tnorm: 'product' });

const rebalanceGate = OR([
  truthValue(cpuModerate),
  truthValue(queueDeep)
], { tnorm: 'zadeh' });

// Weighted decision (all paths evaluated, highest wins)
const decision = [
  { action: 'scaleUp', weight: scaleUpGate.value },
  { action: 'rebalance', weight: rebalanceGate.value },
  { action: 'maintain', weight: 1 - Math.max(scaleUpGate.value, rebalanceGate.value) }
].reduce((best, curr) => curr.weight > best.weight ? curr : best);

decision.action(); // Continuous decision-making
```

## Integration with Heady Architecture

### HeadyBrain Adapter
Replaces hard if/else decision trees with continuous constraint evaluation:
```typescript
const decision = brainAdapter.decide({
  taskId: 'deploy-001',
  agentId: 'HeadyCoder',
  inputs: new Map([['confidence', 0.85], ['load', 45]]),
  constraints: [
    { name: 'min_confidence', truthValue: truthValue(0.7), hard: true },
    { name: 'max_load', truthValue: truthValue(0.6), hard: false }
  ],
  preferences: [
    { name: 'speed', truthValue: truthValue(0.9), weight: 1.5 }
  ]
});
// decision.decision: 'PROCEED' | 'CAUTIOUS' | 'HALT'
// decision.confidence: 0.0-1.0 continuous
```

### HeadyConductor Adapter
Fuzzy system health monitoring:
```typescript
const health = conductorAdapter.evaluateHealth({
  cpuUsage: 78,      // Evaluates as "high" membership = 0.6
  memoryUsage: 65,   // Evaluates as "moderate" membership = 0.7
  errorRate: 0.08,   // Evaluates as "elevated" membership = 0.4
  latencyMs: 850,    // Evaluates as "slow" membership = 0.3
  queueDepth: 45,
  agentAvailability: 0.82
});
// health.action: 'SCALE_UP' | 'REBALANCE' | 'ALERT' | 'MAINTAIN'
// health.urgency: SemanticTruthValue with continuous degree
```

## File Structure
```
Heady_Semantic_Logic_Transform/
├── README.md                                    (this file)
├── packages/
│   └── heady-semantic-logic/
│       ├── package.json
│       ├── tsconfig.json
│       ├── src/
│       │   ├── index.ts                        (main exports)
│       │   ├── core/
│       │   │   ├── truth-value.ts              (SemanticTruthValue class)
│       │   │   ├── gates.ts                    (AND, OR, NOT, NAND, XOR, IMPLY, WEIGHTED_*)
│       │   │   ├── membership.ts               (triangular, gaussian, sigmoid, bell)
│       │   │   ├── semantic-variable.ts        (LinguisticTerm, fuzzification)
│       │   │   ├── rule-engine.ts              (IF-THEN rule evaluation)
│       │   │   └── defuzzifier.ts              (centroid, weighted_average, mom)
│       │   ├── transform/
│       │   │   ├── ast-scanner.ts              (ts-morph AST traversal)
│       │   │   ├── pattern-matcher.ts          (canonical form classification)
│       │   │   ├── logic-mapper.ts             (IR generation)
│       │   │   ├── code-generator.ts           (TypeScript emit)
│       │   │   └── transformer.ts              (main orchestrator)
│       │   ├── integration/
│       │   │   ├── heady-brain-adapter.ts      (decision-making)
│       │   │   ├── heady-conductor-adapter.ts  (health monitoring)
│       │   │   ├── heady-battle-adapter.ts     (validation)
│       │   │   ├── projection-engine.ts        (defuzzify output)
│       │   │   └── monorepo-sync.ts            (git sync)
│       │   ├── utils/
│       │   │   ├── interpolation.ts            (polynomial interpolation)
│       │   │   └── validation.ts               (continuous validators)
│       │   └── cli/
│       │       └── heady-semantic.ts           (CLI interface)
│       └── tests/
├── python-sdk/
│   ├── semantic_gates.py                       (Python runtime)
│   ├── transformer.py                          (Python file transformer)
│   └── requirements.txt
├── scripts/
│   ├── sync_to_monorepo.sh                     (git integration script)
│   ├── build_all.sh                            (build both TS and Python)
│   └── self_extract_builder.sh                 (Gemini 3.1 Pro bash generator)
└── docs/
    ├── THEORY.md                               (fuzzy logic mathematical foundations)
    ├── INTEGRATION.md                          (Heady architecture integration guide)
    └── EXAMPLES.md                             (comprehensive usage examples)
```

## Theory & References

### Fuzzy Logic Foundations
- **Zadeh Operators**: MIN(a,b) for AND, MAX(a,b) for OR, 1-x for NOT
- **Product T-Norm**: a·b for AND, a+b-a·b for OR (probabilistic)
- **Łukasiewicz**: max(0, a+b-1) for AND, min(1, a+b) for OR (bounded)

### Key Papers & Resources
- Wikipedia: Fuzzy Logic (operators, membership functions)
- IBM BioFuzzNet: Differentiable fuzzy logic networks
- NIH: Transforming Boolean models to continuous models via polynomial interpolation
- arXiv: Deep Differentiable Logic Gate Networks
- MarkLogic: Semantic SPARQL queries with fuzzy logic extensions

### Integration with Heady Ecosystem
- **Auto-Success Engine**: Replace 135 binary health checks with continuous monitoring
- **Monte Carlo Simulations**: Use gate outputs as probability distributions for HeadySims
- **Arena Mode**: Evaluate competing solutions with continuous scoring instead of binary win/loss
- **Pattern Recognition**: HeadyVinci learns from continuous gate activations
- **3D Vector Memory**: Embedding-based gates access your vector space at headyme.com

## License
MIT © HeadySystems Inc. 2026

## Author
Eric Haywood <eric@headysystems.com>
Built for the Heady AI ecosystem
