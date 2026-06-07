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
// ║  FILE: src/runtime/deploy-gates.d.ts                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
export = DeployGates;
declare class DeployGates {
    constructor(o?: {});
    gates: {
        id: string;
        name: string;
        check: (c: any) => boolean;
        failMsg: string;
    }[];
    history: any[];
    maxHistory: any;
    evaluate(context?: {}): {
        id: `${string}-${string}-${string}-${string}-${string}`;
        decision: string;
        gates: {
            id: string;
            name: string;
            passed: boolean;
            failMsg: string | null;
        }[];
        failedGates: string[];
        context: {
            ts: string;
        };
        ts: string;
    };
    getHistory(limit?: number): any[];
    status(): {
        totalChecks: number;
        lastDecision: any;
        gateCount: number;
        lastTs: any;
    };
}
//# sourceMappingURL=deploy-gates.d.ts.map