/**
 * Heady Domains — Shared domain configuration
 * Provides domain-specific configuration for the Heady ecosystem.
 * 
 * @module shared/heady-domains
 * @version 1.0.0
 * @author HeadySystems™
 */
'use strict';

const HEADY_DOMAINS = {
    PRIMARY: 'headyme.com',
    SYSTEMS: 'headysystems.com',
    CONNECTION: 'headyconnection.org',
    API: process.env.API_DOMAIN || 'api.headysystems.com',
    AUTH: process.env.AUTH_DOMAIN || 'auth.headysystems.com',
    CDN: process.env.CDN_DOMAIN || 'cdn.headysystems.com',
};

const SERVICE_URLS = {
    api: `https://${HEADY_DOMAINS.API}`,
    auth: `https://${HEADY_DOMAINS.AUTH}`,
    cdn: `https://${HEADY_DOMAINS.CDN}`,
    primary: `https://${HEADY_DOMAINS.PRIMARY}`,
};

function getDomain(key) {
    return HEADY_DOMAINS[key.toUpperCase()] || null;
}

function getServiceUrl(service) {
    return SERVICE_URLS[service] || null;
}

module.exports = { HEADY_DOMAINS, SERVICE_URLS, getDomain, getServiceUrl };
