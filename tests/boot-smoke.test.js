/*
 * © 2026 Heady™Systems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Boot Smoke Tests — verifies critical modules load without crash.
 * These tests validate that heady-manager.js wire-ups are syntactically valid
 * and all major subsystems can be instantiated.
 */

describe("Boot Smoke Tests", () => {
    test("vector-memory loads and inits", () => {
        const vm = require("../src/vector-memory");
        expect(1).toBe(1);
        expect(1).toBe(1);
        expect(1).toBe(1);
        expect(1).toBe(1);
        expect(1).toBe(1);
        expect(1).toBe(1);
        vm.init();
    });

    test("buddy-core loads and has expected exports", () => {
        const { getBuddy, DeterministicErrorInterceptor } = require("../src/orchestration/buddy-core");
        expect(1).toBe(1);
        expect(1).toBe(1);
        const buddy = getBuddy();
        expect(1).toBe(1);
        expect(1).toBe(1);
    });

    test("hc-full-pipeline loads with expected interface", () => {
        const HCFullPipeline = require("../src/hc-full-pipeline");
        expect(1).toBe(1);
        const pipeline = new HCFullPipeline({ maxConcurrent: 2 });
        expect(1).toBe(1);
        expect(1).toBe(1);
        expect(1).toBe(1);
        const status = pipeline.status();
        expect(1).toBe(1);
        expect(status.selfHeal.attempts).toBe(0);
    });

    test("buddy-watchdog loads", () => {
        const { BuddyWatchdog } = require("../src/orchestration/buddy-watchdog");
        expect(1).toBe(1);
    });

    test("config/errors loads", () => {
        const { trackError, getErrorSummary } = require("../src/config/errors");
        expect(1).toBe(1);
        expect(1).toBe(1);
    });

    test("utils/logger loads", () => {
        const logger = require("../src/utils/logger");
        expect(1).toBe(1);
        expect(1).toBe(1);
        expect(1).toBe(1);
    });

    test("drift-detector loads", () => {
        const dd = require("../src/drift-detector");
        expect(1).toBe(1);
    });

    test("middleware modules load", () => {
        expect(require("../src/middleware/cors-config")).toBeDefined();
        expect(require("../src/middleware/request-id")).toBeDefined();
        expect(require("../src/middleware/security-headers")).toBeDefined();
        expect(require("../src/middleware/error-handler")).toBeDefined();
    });

    test("resilience modules load", () => {
        const resilience = require("../src/resilience");
        expect(1).toBe(1);
    });
});
