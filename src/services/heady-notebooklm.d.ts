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
// ║  FILE: src/services/heady-notebooklm.d.ts                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
export function syncToNotion(): Promise<{
    ok: boolean;
    error: string;
} | {
    state: any;
    created: never[];
    updated: never[];
    errors: never[];
    ok: boolean;
    error?: undefined;
} | {
    error: any;
    created: never[];
    updated: never[];
    errors: never[];
    ok: boolean;
}>;
export function updateNotionStatus(event?: {}): Promise<{
    ok: boolean;
    action: any;
    ts: string;
    auditCount: any;
    error?: undefined;
} | {
    ok: boolean;
    error: any;
    action?: undefined;
    ts?: undefined;
    auditCount?: undefined;
}>;
export function registerNotionRoutes(app: any): any;
export function loadState(): any;
//# sourceMappingURL=heady-notion.d.ts.map