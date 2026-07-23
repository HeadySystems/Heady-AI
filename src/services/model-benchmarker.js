/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Model Benchmarking Suite — Run standard test suites to determine LLM ELOs.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';
import { InferenceGateway } from '../inference-gateway.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROSTER_FILE = path.join(__dirname, '..', '..', 'data', 'model-roster.json');

const BENCHMARK_TESTS = [
    {
        id: 'json_format',
        name: 'JSON Format Compliance',
        messages: [
            { role: 'user', content: 'Respond with a valid JSON object containing the keys "status" (string value: "success") and "result" (number value: 42). Return nothing but the JSON, do not wrap in markdown code blocks.' }
        ],
        evaluate: (text) => {
            try {
                const cleanText = text.replace(/```json|```/g, '').trim();
                const obj = JSON.parse(cleanText);
                return obj.status === 'success' && obj.result === 42 ? 1.0 : 0.5;
            } catch (e) {
                return 0.0;
            }
        }
    },
    {
        id: 'code_syntax',
        name: 'JavaScript Syntax Generation',
        messages: [
            { role: 'user', content: 'Write a JavaScript function named "addNumbers" that takes a and b and returns their sum. Return code only, no explanations, no markdown blocks.' }
        ],
        evaluate: (text) => {
            const cleanText = text.replace(/```javascript|```js|```/g, '').trim();
            if (cleanText.includes('function addNumbers') || cleanText.includes('const addNumbers')) {
                // Test parsing
                try {
                    // eslint-disable-next-line no-new-func
                    new Function(cleanText);
                    return 1.0;
                } catch (e) {
                    return 0.5;
                }
            }
            return 0.0;
        }
    },
    {
        id: 'logical_reasoning',
        name: 'Logical Reasoning Math',
        messages: [
            { role: 'user', content: 'A bat and a ball cost $1.10 in total. The bat costs $1.00 more than the ball. How much does the ball cost? Respond with the number of dollars only (e.g., 0.05).' }
        ],
        evaluate: (text) => {
            const val = text.trim();
            if (val.includes('0.05') || val.includes('5 cents') || val === '0.05') {
                return 1.0;
            }
            return 0.0;
        }
    }
];

class ModelBenchmarker {
    constructor() {
        this.gateway = new InferenceGateway();
    }

    async benchmarkModel(modelRecord) {
        logger.info(`[ModelBenchmarker] Benchmarking model: ${modelRecord.id} (Provider: ${modelRecord.provider})`);
        let totalScore = 0;
        let totalLatency = 0;
        let successfulRuns = 0;

        for (const test of BENCHMARK_TESTS) {
            const start = Date.now();
            try {
                const res = await this.gateway.complete(test.messages, {
                    provider: modelRecord.provider,
                    model: modelRecord.id,
                    maxTokens: 100,
                    temperature: 0.1,
                });
                const latency = Date.now() - start;
                totalLatency += latency;

                const score = test.evaluate(res.content);
                totalScore += score;
                successfulRuns++;

                logger.debug(`[ModelBenchmarker] Test: ${test.name} for ${modelRecord.id} -> Score: ${score}, Latency: ${latency}ms`);
            } catch (e) {
                logger.warn(`[ModelBenchmarker] Test failed: ${test.name} for ${modelRecord.id}`, { error: e.message });
            }
        }

        if (successfulRuns === 0) {
            return { ok: false, error: 'All benchmark tests failed' };
        }

        const avgScore = totalScore / BENCHMARK_TESTS.length; // 0.0 to 1.0
        const avgLatency = totalLatency / successfulRuns;

        // ELO formula: 800 (base) + score * 300 + latency penalty (up to 100 points)
        const latencyPenalty = Math.min(100, Math.max(0, (avgLatency - 200) / 10)); // penalty increases above 200ms
        const elo = Math.round(800 + (avgScore * 300) - latencyPenalty + 100); // offset so perfect fast models get ~1200 ELO

        return {
            ok: true,
            score: avgScore,
            avgLatencyMs: Math.round(avgLatency),
            elo: Math.max(500, elo),
        };
    }

    async runSuite() {
        if (!fs.existsSync(ROSTER_FILE)) {
            logger.warn('[ModelBenchmarker] Roster file missing. Running scan first.');
            return { ok: false, error: 'No active model roster found' };
        }

        const roster = JSON.parse(fs.readFileSync(ROSTER_FILE, 'utf8'));
        const models = Object.values(roster.models).filter(m => m.available);

        logger.info(`[ModelBenchmarker] Running benchmark suite against ${models.length} active models...`);
        const results = [];

        for (const model of models) {
            // Only benchmark models from configured providers to avoid timeout blocks
            const envKey = model.provider === 'google' || model.provider === 'gemini' ? 'GOOGLE_API_KEY' : 
                           model.provider === 'openai' ? 'OPENAI_API_KEY' : 
                           model.provider === 'groq' ? 'GROQ_API_KEY' : 
                           model.provider === 'claude' ? 'ANTHROPIC_API_KEY' : null;
            
            if (envKey && !process.env[envKey] && !process.env['GEMINI_API_KEY']) {
                logger.debug(`[ModelBenchmarker] Skipping ${model.id} - Provider credentials missing`);
                continue;
            }

            const res = await this.benchmarkModel(model);
            if (res.ok) {
                roster.models[model.id].elo = res.elo;
                roster.models[model.id].lastBenchmark = {
                    ts: new Date().toISOString(),
                    score: res.score,
                    avgLatencyMs: res.avgLatencyMs,
                };
                results.push({ id: model.id, elo: res.elo, latency: res.avgLatencyMs });
            }
        }

        fs.writeFileSync(ROSTER_FILE, JSON.stringify(roster, null, 2));
        logger.info('[ModelBenchmarker] Benchmark suite run completed and ELOs saved.');
        return results;
    }
}

export const modelBenchmarker = new ModelBenchmarker();
