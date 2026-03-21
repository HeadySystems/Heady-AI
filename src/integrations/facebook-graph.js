/**
 * Facebook Graph API Integration — Heady™ Automated Page Management
 *
 * Handles:
 *   - Automated page posting (text, images, links)
 *   - Page insights retrieval
 *   - Comment management
 *   - Post scheduling
 *
 * Uses the Page Access Token stored in FACEBOOK_PAGE_ACCESS_TOKEN.
 * App credentials (FACEBOOK_APP_ID / FACEBOOK_APP_SECRET) are used
 * for token refresh and app-level operations.
 *
 * © 2026 Heady™ Systems Inc. All rights reserved.
 */
const logger = console;


const GRAPH_API_VERSION = 'v19.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
const logger = require('../utils/logger');

class FacebookGraph {
    constructor(opts = {}) {
        this.pageAccessToken = opts.pageAccessToken || process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
        this.appId = opts.appId || process.env.FACEBOOK_APP_ID;
        this.appSecret = opts.appSecret || process.env.FACEBOOK_APP_SECRET;
        this.pageId = opts.pageId || null; // auto-discovered on first call
    }

    // ─── Core request helper ─────────────────────────────────────
    async _request(endpoint, method = 'GET', body = null) {
        const url = new URL(`${GRAPH_BASE}${endpoint}`);
        if (method === 'GET' && this.pageAccessToken) {
            url.searchParams.set('access_token', this.pageAccessToken);
        }

        const fetchOpts = { method, headers: {} };

        if (body && method !== 'GET') {
            if (body instanceof URLSearchParams) {
                fetchOpts.body = body.toString();
                fetchOpts.headers['Content-Type'] = 'application/x-www-form-urlencoded';
            } else {
                fetchOpts.body = JSON.stringify(body);
                fetchOpts.headers['Content-Type'] = 'application/json';
            }
        }

        const res = await fetch(url.toString(), fetchOpts);
        const data = await res.json();

        if (data.error) {
            const err = new Error(`Facebook Graph API Error: ${data.error.message}`);
            err.code = data.error.code;
            err.type = data.error.type;
            throw err;
        }

        return data;
    }

    // ─── Page Discovery ──────────────────────────────────────────
    async getPageId() {
        if (this.pageId) return this.pageId;

        const data = await this._request('/me?fields=id,name');
        this.pageId = data.id;
        this.pageName = data.name;
        logger.info(`[facebook-graph] Discovered page: ${data.name} (${data.id})`);
        return this.pageId;
    }

    // ─── Posting ─────────────────────────────────────────────────

    /**
     * Publish a text post to the page feed.
     * @param {string} message - The post content
     * @returns {Object} - { id: 'post_id' }
     */
    async publishPost(message) {
        const pageId = await this.getPageId();
        const params = new URLSearchParams();
        params.set('message', message);
        params.set('access_token', this.pageAccessToken);

        return this._request(`/${pageId}/feed`, 'POST', params);
    }

    /**
     * Publish a link post with commentary.
     * @param {string} message - Commentary text
     * @param {string} link - URL to share
     * @returns {Object}
     */
    async publishLink(message, link) {
        const pageId = await this.getPageId();
        const params = new URLSearchParams();
        params.set('message', message);
        params.set('link', link);
        params.set('access_token', this.pageAccessToken);

        return this._request(`/${pageId}/feed`, 'POST', params);
    }

    /**
     * Publish a photo with caption.
     * @param {string} caption - Photo caption
     * @param {string} imageUrl - Public URL of the image
     * @returns {Object}
     */
    async publishPhoto(caption, imageUrl) {
        const pageId = await this.getPageId();
        const params = new URLSearchParams();
        params.set('caption', caption);
        params.set('url', imageUrl);
        params.set('access_token', this.pageAccessToken);

        return this._request(`/${pageId}/photos`, 'POST', params);
    }

    /**
     * Schedule a post for future publication.
     * @param {string} message - Post content
     * @param {Date|number} scheduledTime - Unix timestamp or Date object
     * @returns {Object}
     */
    async schedulePost(message, scheduledTime) {
        const pageId = await this.getPageId();
        const timestamp = scheduledTime instanceof Date
            ? Math.floor(scheduledTime.getTime() / 1000)
            : scheduledTime;

        const params = new URLSearchParams();
        params.set('message', message);
        params.set('published', 'false');
        params.set('scheduled_publish_time', String(timestamp));
        params.set('access_token', this.pageAccessToken);

        return this._request(`/${pageId}/feed`, 'POST', params);
    }

    // ─── Insights ────────────────────────────────────────────────

    /**
     * Get page-level insights.
     * @param {string[]} metrics - Metric names (e.g., 'page_impressions', 'page_engaged_users')
     * @param {string} period - 'day', 'week', 'days_28', 'month', 'lifetime'
     * @returns {Object}
     */
    async getPageInsights(metrics = ['page_impressions', 'page_engaged_users', 'page_fans'], period = 'day') {
        const pageId = await this.getPageId();
        return this._request(`/${pageId}/insights?metric=${metrics.join(',')}&period=${period}`);
    }

    /**
     * Get insights for a specific post.
     * @param {string} postId - The post ID
     * @param {string[]} metrics
     * @returns {Object}
     */
    async getPostInsights(postId, metrics = ['post_impressions', 'post_engaged_users', 'post_clicks']) {
        return this._request(`/${postId}/insights?metric=${metrics.join(',')}`);
    }

    // ─── Feed Management ─────────────────────────────────────────

    /**
     * Get recent posts from the page feed.
     * @param {number} limit - Number of posts to retrieve
     * @returns {Object}
     */
    async getFeed(limit = 10) {
        const pageId = await this.getPageId();
        return this._request(`/${pageId}/feed?fields=id,message,created_time,shares,likes.summary(true),comments.summary(true)&limit=${limit}`);
    }

    /**
     * Delete a specific post.
     * @param {string} postId
     * @returns {Object}
     */
    async deletePost(postId) {
        return this._request(`/${postId}`, 'DELETE');
    }

    /**
     * Reply to a comment on a post.
     * @param {string} commentId
     * @param {string} message
     * @returns {Object}
     */
    async replyToComment(commentId, message) {
        const params = new URLSearchParams();
        params.set('message', message);
        params.set('access_token', this.pageAccessToken);
        return this._request(`/${commentId}/comments`, 'POST', params);
    }

    // ─── Token Utilities ─────────────────────────────────────────

    /**
     * Debug/inspect the current access token.
     * @returns {Object} Token metadata (app, scopes, expiry, etc.)
     */
    async debugToken() {
        return this._request(`/debug_token?input_token=${this.pageAccessToken}&access_token=${this.appId}|${this.appSecret}`);
    }

    /**
     * Exchange a short-lived token for a long-lived one.
     * @param {string} shortToken
     * @returns {Object} { access_token, token_type, expires_in }
     */
    async exchangeForLongLivedToken(shortToken) {
        const params = new URLSearchParams();
        params.set('grant_type', 'fb_exchange_token');
        params.set('client_id', this.appId);
        params.set('client_secret', this.appSecret);
        params.set('fb_exchange_token', shortToken || this.pageAccessToken);

        return this._request('/oauth/access_token?' + params.toString());
    }

    // ─── Health Check ────────────────────────────────────────────

    /**
     * Quick health / connectivity check.
     * @returns {Object} { ok, pageId, pageName, tokenValid }
     */
    async healthCheck() {
        try {
            const tokenInfo = await this.debugToken();
            const page = await this.getPageId();
            return {
                ok: true,
                pageId: page,
                pageName: this.pageName,
                tokenValid: tokenInfo.data?.is_valid || false,
                scopes: tokenInfo.data?.scopes || [],
                expiresAt: tokenInfo.data?.expires_at
                    ? new Date(tokenInfo.data.expires_at * 1000).toISOString()
                    : 'never',
            };
        } catch (err) {
            return { ok: false, error: err.message };
        }
    }
}

module.exports = { FacebookGraph };
