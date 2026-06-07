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
// ║  FILE: src/bees/pipeline-bee.d.ts                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
export const domain: "pipeline";
export const description: "Full pipeline execution engine, stages, circuit breakers, task dispatch";
export const priority: 0.9;
export function getWork(ctx?: {}): ((() => Promise<{
    bee: string;
    action: string;
    stages: any;
    loaded?: undefined;
} | {
    bee: string;
    action: string;
    loaded: boolean;
    stages?: undefined;
}>) | (() => Promise<{
    bee: string;
    action: string;
    circuitBreaker: boolean;
    workerPool: boolean;
    loaded?: undefined;
} | {
    bee: string;
    action: string;
    loaded: boolean;
    circuitBreaker?: undefined;
    workerPool?: undefined;
}>) | (() => Promise<{
    bee: string;
    action: string;
    loaded: boolean;
}>))[];
//# sourceMappingURL=pipeline-bee.d.ts.map