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
// ║  FILE: src/runtime/hc_cloudflare.d.ts                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
export class CloudflareManager {
    constructor(secretsManager: any);
    _secretsManager: any;
    _token: string | null;
    _accountId: string | null;
    expiresAt: any;
    _zones: any[];
    isTokenValid(): boolean;
    _timeUntil(dateStr: any): string;
    verifyToken(): Promise<{
        valid: any;
        status: any;
        error?: undefined;
    } | {
        valid: boolean;
        error: any;
        status?: undefined;
    }>;
    listZones(): Promise<any[]>;
    getStatus(): {
        tokenPresent: boolean;
        tokenValid: boolean;
        accountId: string | null;
        cachedZones: number;
        expiresAt: any;
        expiresIn: string | null;
    };
}
export function registerCloudflareRoutes(app: any, cfManager: any): void;
//# sourceMappingURL=hc_cloudflare.d.ts.map