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
// ║  FILE: src/bootstrap/vector-stack.d.ts                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
declare function _exports(app: any, { logger, eventBus }: {
    logger: any;
    eventBus: any;
}): {
    vectorMemory: typeof import("../vector-memory");
    buddy: any;
    watchdog: import("../orchestration/buddy-watchdog").BuddyWatchdog;
    conductor: any;
    orchestrator: any;
    Handshake: {
        _tokenCache: Map<any, any>;
        _secret: string;
        _pqcEnabled: boolean;
        generateToken(nodeId: string): string;
        validateToken(token: string): Object;
        middleware(req: any, res: any, next: any): any;
    };
    selfAwareness: typeof import("../self-awareness") | null;
    pipeline: any;
};
export = _exports;
//# sourceMappingURL=vector-stack.d.ts.map