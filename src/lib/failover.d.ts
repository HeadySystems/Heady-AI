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
// ║  FILE: src/lib/failover.d.ts                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
export = MultiCloudFailover;
declare class MultiCloudFailover {
    constructor(opts?: {});
    primary: any;
    fallback: any;
    healthCheckInterval: any;
    _primaryHealthy: boolean;
    _failoverCount: number;
    _lastCheck: number;
    route(request: any): Promise<{
        backend: any;
        status: number;
        data: unknown;
    }>;
    _fetch(backend: any, request: any): Promise<{
        backend: any;
        status: number;
        data: unknown;
    }>;
    _healthCheck(backend: any): Promise<void>;
    getStatus(): {
        primary: any;
        fallback: any;
        failoverCount: number;
    };
}
//# sourceMappingURL=failover.d.ts.map