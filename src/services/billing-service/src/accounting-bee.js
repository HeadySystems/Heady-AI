/**
 * AccountingBee — Autonomous Financial Reconciliation
 * 
 * Prepares ledgers for export to QuickBooks/Xero and generates P&L snapshots.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const hdc = require('./heady-coin');

class AccountingBee {
    constructor() {
        this.reportDir = path.join(process.cwd(), 'data', 'reports', 'finance');
        this._ensureDir();
    }

    _ensureDir() {
        if (!fs.existsSync(this.reportDir)) {
            fs.mkdirSync(this.reportDir, { recursive: true });
        }
    }

    /**
     * Generate a monthly financial report in JSON format.
     */
    async generateMonthlyReport(month = new Date().toISOString().slice(0, 7)) {
        const ledger = hdc._readLedger();
        
        const report = {
            period: month,
            totalHDCVolume: ledger.totalSupply,
            totalUSDValue: hdc.hdcToUsd(ledger.totalSupply),
            transactionCount: ledger.transactions.length,
            generatedAt: new Date().toISOString(),
            revenueByType: {
                subscriptions: 0,
                computeSettlement: 0,
                minting: 0
            }
        };

        ledger.transactions.forEach(tx => {
            if (tx.type === 'MINT') report.revenueByType.minting += tx.amount;
            if (tx.reason?.includes('Compute')) report.revenueByType.computeSettlement += tx.amount;
        });

        const fileName = `finance-report-${month}.json`;
        fs.writeFileSync(path.join(this.reportDir, fileName), JSON.stringify(report, null, 2));
        
        console.log(`📑 [Accounting] Generated report: ${fileName}`);
        return report;
    }

    /**
     * Export transactions to CSV for external accounting software.
     */
    exportToCSV() {
        const ledger = hdc._readLedger();
        const headers = 'Date,ID,Type,From,To,Amount(HDC),USD_Value,Reason\n';
        
        const rows = ledger.transactions.map(tx => {
            const usd = hdc.hdcToUsd(tx.amount);
            return `${tx.timestamp},${tx.id},${tx.type},${tx.from || ''},${tx.to || ''},${tx.amount},${usd},"${tx.reason || ''}"`;
        }).join('\n');

        const csvPath = path.join(this.reportDir, 'ledger-export.csv');
        fs.writeFileSync(csvPath, headers + rows);
        
        return csvPath;
    }
}

module.exports = new AccountingBee();
