/**
 * Heady™ Billing Service
 * Integration with Stripe for Developer and Team tiers.
 * 
 * © 2026 Heady™Systems Inc.
 */

const Stripe = require('stripe');

class BillingService {
    constructor() {
        this.stripe = process.env.STRIPE_SECRET_KEY 
            ? new Stripe(process.env.STRIPE_SECRET_KEY) 
            : null;
        
        this.tiers = {
            developer: {
                id: 'prod_heady_dev',
                price: 2900, // $29.00
                currency: 'usd',
            },
            team: {
                id: 'prod_heady_team',
                price: 9900, // $99.00 per seat
                currency: 'usd',
            }
        };
    }

    /**
     * Calculate Semantic Weight of a task.
     * Complexity is a float 0.0 - 1.0 (CSL logic).
     */
    calculateSemanticWeight(tokens, complexity) {
        const baseRate = 0.00001; // $0.01 per 1000 tokens base
        const weightFactor = 1 + (complexity * Math.PI); // Scaled by Pi for non-linear weighting
        return tokens * baseRate * weightFactor;
    }

    /**
     * Create a checkout session for the Developer Tier.
     */
    async createDeveloperSession(userId, customerEmail) {
        if (!this.stripe) throw new Error('Stripe not configured');

        const session = await this.stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: this.tiers.developer.currency,
                    product_data: {
                        name: 'Heady Developer Tier',
                        description: 'Unrestricted Sovereign AI access + Private Vault',
                    },
                    unit_amount: this.tiers.developer.price,
                    recurring: { interval: 'month' },
                },
                quantity: 1,
            }],
            mode: 'subscription',
            success_url: 'https://headyme.com/success?session_id={CHECKOUT_SESSION_ID}',
            cancel_url: 'https://headyme.com/cancel',
            customer_email: customerEmail,
            metadata: { userId, tier: 'developer' },
        });

        return session.url;
    }

    /**
     * Handle Webhook events for subscription lifecycle.
     */
    async handleWebhook(signature, payload) {
        // Implementation for Stripe webhook handling (sig verification, etc.)
        // Updates user state in pgvector/redis
    }
}

module.exports = new BillingService();
