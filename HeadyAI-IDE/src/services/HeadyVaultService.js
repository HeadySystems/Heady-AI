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
// ║  FILE: HeadyAI-IDE/src/services/HeadyVaultService.js             ║
// ║  LAYER: frontend/src/services                                    ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

import storageService from './StorageService';

class HeadyVaultService {
  constructor() {
    this.token = null;
    this.user = null;
    this.isAuthenticated = false;
    this.authListeners = new Set();
  }

  async initialize() {
    // Attempt to load from storage
    const savedToken = await storageService.getItem('heady_vault_token');
    const savedUser = await storageService.getItem('heady_vault_user');

    if (savedToken && savedUser) {
      this.token = savedToken;
      this.user = JSON.parse(savedUser);
      this.isAuthenticated = true;
      this._notifyListeners();
    }
  }

  // Cross-domain SSO via auth.headysystems.com
  async authenticate() {
    // In a real environment, this would redirect to auth.headysystems.com
    // For now, we simulate Sovereign Boot
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockToken = 'hv_' + crypto.randomUUID().replace(/-/g, '') + '_' + Date.now().toString(36);
        const mockUser = {
          id: 'usr_' + crypto.randomUUID().split('-')[0],
          email: 'developer@headysystems.com',
          role: 'sovereign-admin',
          claims: ['ide:access', 'cloud:compute', 'vault:read']
        };

        this._setSession(mockToken, mockUser);
        resolve({ token: mockToken, user: mockUser });
      }, 800); // Simulate network delay
    });
  }

  async logout() {
    this.token = null;
    this.user = null;
    this.isAuthenticated = false;
    
    await storageService.removeItem('heady_vault_token');
    await storageService.removeItem('heady_vault_user');
    
    this._notifyListeners();
  }

  getToken() {
    return this.token;
  }

  getUser() {
    return this.user;
  }

  onAuthChange(callback) {
    this.authListeners.add(callback);
    return () => this.authListeners.delete(callback);
  }

  _setSession(token, user) {
    this.token = token;
    this.user = user;
    this.isAuthenticated = true;

    storageService.setItem('heady_vault_token', token);
    storageService.setItem('heady_vault_user', JSON.stringify(user));

    this._notifyListeners();
  }

  _notifyListeners() {
    this.authListeners.forEach(cb => {
      try { cb({ isAuthenticated: this.isAuthenticated, user: this.user }); } 
      catch (e) { console.error('[HeadyVault] Listener error', e); }
    });
  }
}

const headyVaultService = new HeadyVaultService();
export default headyVaultService;
export { HeadyVaultService };
