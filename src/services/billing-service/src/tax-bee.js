/**
 * TaxBee — Autonomous Tax Compliance
 * 
 * Calculates Sales Tax and VAT for global transactions.
 * Uses φ-scaled regional baselines as fallbacks.
 */

'use strict';

class TaxBee {
    constructor() {
        this.regionalRates = {
            'US': 0.08875, // NYC Baseline
            'EU': 0.19,    // DE Baseline
            'GB': 0.20,
            'CA': 0.13,
            'INTL': 0.1618 // φ-scaled international baseline
        };
    }

    /**
     * Calculate tax for an amount.
     * @param {number} amount — in USD/HDC
     * @param {string} countryCode 
     */
    calculateTax(amount, countryCode = 'US') {
        const rate = this.regionalRates[countryCode] || this.regionalRates['INTL'];
        const taxAmount = amount * rate;
        
        console.log(`🧾 [TaxBee] Calculated ${countryCode} tax: $${taxAmount.toFixed(2)} (Rate: ${(rate * 100).toFixed(2)}%)`);
        
        return {
            rate,
            taxAmount,
            total: amount + taxAmount,
            countryCode
        };
    }

    /**
     * Generate a tax liability report for AccountingBee.
     */
    async generateTaxReport(transactions) {
        const summary = {
            totalTaxCollected: 0,
            byRegion: {}
        };

        transactions.forEach(tx => {
            const country = tx.country || 'US';
            const tax = this.calculateTax(tx.amount, country);
            summary.totalTaxCollected += tax.taxAmount;
            summary.byRegion[country] = (summary.byRegion[country] || 0) + tax.taxAmount;
        });

        return summary;
    }
}

module.exports = new TaxBee();
