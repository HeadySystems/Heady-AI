/**
 * HeadyEvalEngine — 4-Layer quality evaluation engine.
 * Adapted from OpenClaw Mission Control agent-evals.ts to Kotlin + Room.
 *
 * Layer 1: Task Completion (≥ 70%)
 * Layer 2: Loop Detection (tool:unique ratio ≤ 3:1)
 * Layer 3: Tool Reliability (≥ 80%)
 * Layer 4: Drift Detection (≤ 10% vs 4-week baseline)
 *
 * © 2026 HeadySystems Inc. All Rights Reserved.
 */
package com.headysystems.buddy.core.eval

import com.headysystems.buddy.core.models.DriftResult
import com.headysystems.buddy.core.models.EvalLayer
import com.headysystems.buddy.core.models.EvalResult
import com.headysystems.buddy.core.models.FullEvalReport
import kotlin.math.abs

/**
 * Database interface for eval queries.
 * Implemented by Room DAOs in the app modules.
 */
interface EvalDataSource {
    fun getTaskCompletionStats(agentId: String, sinceMs: Long): CompletionStats
    fun getToolCallStats(agentId: String, sinceMs: Long): ToolCallStats
    fun getToolReliabilityStats(agentId: String, sinceMs: Long): ReliabilityStats
    fun getAvgTokens(agentId: String, fromMs: Long, toMs: Long): Float
    fun getToolSuccessRate(agentId: String, fromMs: Long, toMs: Long): Float
    fun getTaskCompletionRate(agentId: String, fromMs: Long, toMs: Long): Float
}

data class CompletionStats(val completed: Int, val total: Int)
data class ToolCallStats(val totalCalls: Int, val uniqueTools: Int)
data class ReliabilityStats(val successes: Int, val total: Int)

class HeadyEvalEngine(private val ds: EvalDataSource) {

    companion object {
        private const val TASK_COMPLETION_THRESHOLD = 0.70f
        private const val TOOL_RELIABILITY_THRESHOLD = 0.80f
        private const val LOOP_RATIO_LIMIT = 3.0f
        private const val DRIFT_THRESHOLD = 0.10f
        private const val HOUR_MS = 3_600_000L
        private const val WEEK_MS = 7 * 24 * HOUR_MS
    }

    private fun since(hours: Int): Long = System.currentTimeMillis() - hours * HOUR_MS

    /**
     * Layer 1: Task Completion — what % of tasks completed successfully?
     * Threshold: ≥ 70%
     */
    fun evalTaskCompletion(agentId: String, hours: Int = 168): EvalResult {
        val stats = ds.getTaskCompletionStats(agentId, since(hours))
        val score = if (stats.total > 0) stats.completed.toFloat() / stats.total else 1f
        return EvalResult(
            layer = EvalLayer.OUTPUT,
            score = score,
            passed = score >= TASK_COMPLETION_THRESHOLD,
            detail = "${stats.completed}/${stats.total} tasks (${(score * 100).toInt()}%)"
        )
    }

    /**
     * Layer 2: Loop Detection — is the agent repeating tool calls?
     * Convergence score = ratio of total:unique tool calls. Looping if > 3:1.
     */
    fun evalReasoningCoherence(agentId: String, hours: Int = 24): EvalResult {
        val stats = ds.getToolCallStats(agentId, since(hours))
        val ratio = if (stats.uniqueTools > 0) stats.totalCalls.toFloat() / stats.uniqueTools else 1f
        val looping = ratio > LOOP_RATIO_LIMIT
        val score = if (looping) minOf(1f, LOOP_RATIO_LIMIT / ratio) else 1f
        return EvalResult(
            layer = EvalLayer.TRACE,
            score = score,
            passed = !looping,
            detail = "${stats.totalCalls} calls / ${stats.uniqueTools} unique " +
                    "(ratio ${String.format("%.1f", ratio)})" +
                    if (looping) " — LOOPING" else ""
        )
    }

    /**
     * Layer 3: Tool Reliability — what % of tool calls succeed?
     * Threshold: ≥ 80%
     */
    fun evalToolReliability(agentId: String, hours: Int = 24): EvalResult {
        val stats = ds.getToolReliabilityStats(agentId, since(hours))
        val score = if (stats.total > 0) stats.successes.toFloat() / stats.total else 1f
        return EvalResult(
            layer = EvalLayer.COMPONENT,
            score = score,
            passed = score >= TOOL_RELIABILITY_THRESHOLD,
            detail = "Reliability: ${stats.successes}/${stats.total} (${(score * 100).toInt()}%)"
        )
    }

    /**
     * Layer 4: Drift Detection — has any metric shifted > 10% from its 4-week baseline?
     */
    fun runDriftCheck(agentId: String): List<DriftResult> {
        val now = System.currentTimeMillis()
        val oneWeekAgo = now - WEEK_MS
        val fourWeeksAgo = now - 4 * WEEK_MS

        return listOf(
            checkDrift("avg_tokens_per_session",
                ds.getAvgTokens(agentId, oneWeekAgo, now),
                ds.getAvgTokens(agentId, fourWeeksAgo, oneWeekAgo)),
            checkDrift("tool_success_rate",
                ds.getToolSuccessRate(agentId, oneWeekAgo, now),
                ds.getToolSuccessRate(agentId, fourWeeksAgo, oneWeekAgo)),
            checkDrift("task_completion_rate",
                ds.getTaskCompletionRate(agentId, oneWeekAgo, now),
                ds.getTaskCompletionRate(agentId, fourWeeksAgo, oneWeekAgo))
        )
    }

    private fun checkDrift(metric: String, current: Float, baseline: Float): DriftResult {
        val delta = if (baseline != 0f) abs(current - baseline) / abs(baseline)
        else if (current != 0f) 1f else 0f
        return DriftResult(
            metric = metric,
            current = current,
            baseline = baseline,
            delta = delta,
            drifted = delta > DRIFT_THRESHOLD,
            threshold = DRIFT_THRESHOLD
        )
    }

    /**
     * Run all 4 layers. Returns go/no-go report.
     * Used by HeadyEvalWorker (hourly) and CI/CD eval-gate.
     */
    fun runFullEval(agentId: String): FullEvalReport {
        val results = listOf(
            evalTaskCompletion(agentId),
            evalReasoningCoherence(agentId),
            evalToolReliability(agentId)
        )
        val drift = runDriftCheck(agentId)
        val allPassed = results.all { it.passed } && drift.none { it.drifted }
        return FullEvalReport(results, drift, allPassed)
    }
}
