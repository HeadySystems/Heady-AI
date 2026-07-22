const { PatternWeaver, TickBuffer } = require('./src/services/trader-widget.js');
const DriftDetector = require('./src/drift-detector.js');

const weaver = new PatternWeaver();
const driftDetector = new DriftDetector();

driftDetector.on('apex_router_triggered', (data) => {
    console.log(`\n💥 APEX ROUTER ACTIVATED BY DRIFT DETECTOR 💥`);
    console.log(`Reason: ${data.payload.reason}`);
});

console.log("=== MEASURING CSL FILTER & FUNCTION DRIFT ===\n");

// Helper to simulate market conditions
const generateTicks = (trend, noiseLevel) => {
    const ticks = [];
    let price = 100;
    for(let i=0; i<100; i++) {
        // Trend + noise
        price += trend + (Math.random() - 0.5) * noiseLevel;
        ticks.push({ ts: Date.now() + i, price, volume: 10, side: 'buy' });
    }
    return ticks;
};

// Iteration 1: Baseline (Strong Trend)
const baselineTicks = generateTicks(0.5, 0.05);
const baselineAnalysis = weaver.analyze(baselineTicks);
console.log(`[Baseline] CSL Confidence: ${baselineAnalysis.confidence.toFixed(4)} | Pattern: ${baselineAnalysis.pattern}`);
driftDetector.snapshot("pattern_weaver_csl", baselineAnalysis);

// Iteration 2: Slight signal degradation
const drift1Ticks = generateTicks(0.4, 0.3);
const drift1Analysis = weaver.analyze(drift1Ticks);
console.log(`[Drift +1] CSL Confidence: ${drift1Analysis.confidence.toFixed(4)} | Pattern: ${drift1Analysis.pattern}`);
driftDetector.snapshot("pattern_weaver_csl", drift1Analysis);

// Iteration 3: Severe signal degradation (Mostly Noise)
const drift2Ticks = generateTicks(0.01, 0.9);
const drift2Analysis = weaver.analyze(drift2Ticks);
console.log(`[Drift +2] CSL Confidence: ${drift2Analysis.confidence.toFixed(4)} | Pattern: ${drift2Analysis.pattern}`);
driftDetector.snapshot("pattern_weaver_csl", drift2Analysis);

console.log("\n=== DRIFT DETECTOR REPORT ===");
const events = driftDetector.getLatest();
if (events.length === 0) {
    console.log("No drift detected (output remained perfectly deterministic).");
} else {
    events.forEach(e => {
        console.log(`🚨 Drift Detected: Hash mutated ${e.beforeHash} -> ${e.afterHash}`);
    });
}

console.log("\n=== CSL FILTER GATE CHECK (THRESHOLD >= 0.85) ===");
const results = [
    { name: "Baseline", conf: baselineAnalysis.confidence },
    { name: "Drift +1", conf: drift1Analysis.confidence },
    { name: "Drift +2", conf: drift2Analysis.confidence }
];

results.forEach(r => {
    const passed = r.conf >= 0.85;
    console.log(`- ${r.name}: ${r.conf.toFixed(4)} -> ${passed ? "✅ ACTIONABLE (Trigger Apex)" : "❌ NOISE (Filtered out)"}`);
});
