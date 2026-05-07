/**
 * HeadyCoin (HDC) — Sovereign Internal Settlement Token
 * 
 * Used for autonomous cross-node resource settlement and liquidity.
 * Base Value: 1 HDC = $0.01618 (φ-scaled base)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const HDC_USD_RATE = 0.01618;

class HeadyCoinService {
    constructor() {
        this.ledgerPath = path.join(process.cwd(), 'data', 'ledger', 'hdc-ledger.json');
        this._initLedger();
    }

    _initLedger() {
        if (!fs.existsSync(path.dirname(this.ledgerPath))) {
            fs.mkdirSync(path.dirname(this.ledgerPath), { recursive: true });
        }
        if (!fs.existsSync(this.ledgerPath)) {
            fs.writeFileSync(this.ledgerPath, JSON.stringify({
                totalSupply: 0,
                wallets: {},
                transactions: []
            }, null, 2));
        }
    }

    /**
     * Create a wallet for a node or user.
     */
    createWallet(ownerId) {
        const ledger = this._readLedger();
        if (ledger.wallets[ownerId]) return ledger.wallets[ownerId];

        const wallet = {
            address: `hdc_${uuidv4().replace(/-/g, '').slice(0, 24)}`,
            balance: 0,
            createdAt: new Date().toISOString()
        };

        ledger.wallets[ownerId] = wallet;
        this._writeLedger(ledger);
        return wallet;
    }

    /**
     * Mint HDC (Sovereign Emission).
     */
    mint(ownerId, amount) {
        const ledger = this._readLedger();
        if (!ledger.wallets[ownerId]) this.createWallet(ownerId);
        
        ledger.wallets[ownerId].balance += amount;
        ledger.totalSupply += amount;
        
        ledger.transactions.push({
            id: uuidv4(),
            type: 'MINT',
            to: ownerId,
            amount,
            timestamp: new Date().toISOString()
        });

        this._writeLedger(ledger);
    }

    /**
     * Transfer HDC between wallets.
     */
    transfer(fromId, toId, amount, reason = 'settlement') {
        const ledger = this._readLedger();
        
        if (!ledger.wallets[fromId] || ledger.wallets[fromId].balance < amount) {
            throw new Error('Insufficient HDC balance');
        }
        if (!ledger.wallets[toId]) this.createWallet(toId);

        ledger.wallets[fromId].balance -= amount;
        ledger.wallets[toId].balance += amount;

        ledger.transactions.push({
            id: uuidv4(),
            type: 'TRANSFER',
            from: fromId,
            to: toId,
            amount,
            reason,
            timestamp: new Date().toISOString()
        });

        this._writeLedger(ledger);
        return true;
    }

    getBalance(ownerId) {
        const ledger = this._readLedger();
        return ledger.wallets[ownerId]?.balance || 0;
    }

    usdToHdc(usdAmount) {
        return Math.floor(usdAmount / HDC_USD_RATE);
    }

    hdcToUsd(hdcAmount) {
        return (hdcAmount * HDC_USD_RATE).toFixed(4);
    }

    _readLedger() {
        return JSON.parse(fs.readFileSync(this.ledgerPath, 'utf8'));
    }

    _writeLedger(ledger) {
        fs.writeFileSync(this.ledgerPath, JSON.stringify(ledger, null, 2));
    }
}

module.exports = new HeadyCoinService();
