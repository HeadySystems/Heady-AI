const { HeadyAutonomy } = require('./src/services/heady-autonomy.js');

// Mock a pattern engine
const mockPatternEngine = {
    getConvergedPatterns: () => [
        { id: "pattern-01", description: "Literal heat reported daily at 2PM", cslScore: 0.95 },
        { id: "pattern-02", description: "UI button misaligned", cslScore: 0.40 }
    ]
};

const autonomy = new HeadyAutonomy({ patternEngine: mockPatternEngine });

// Listen for the new execution hook
autonomy.on("converged_pattern_actionable", (data) => {
    console.log("✅ TRIGGERED actionable event:", data);
});

autonomy.on("apex_router_triggered", (data) => {
    console.log("✅ TRIGGERED apex router:", data);
});

console.log("Executing pattern build cycle...");
autonomy._buildExperience().then(() => {
    console.log("Done.");
});
