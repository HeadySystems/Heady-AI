/**
 * Event Bus Proxy — Maps orchestrated event bus to services
 * @module services/event-bus
 */
'use strict';
// Re-export the actual orchestration event bus to satisfy legacy service imports
module.exports = require('../orchestration/heady-event-bus');
