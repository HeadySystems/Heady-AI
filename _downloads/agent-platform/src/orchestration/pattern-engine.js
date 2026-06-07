// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Pattern Engine v1.0.0                                  ║
// ║  8 first-class multi-agent execution patterns                  ║
// ║  Absorbed from: Google ADK, LangGraph, CrewAI, AutoGen         ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝
import { DAGExecutor } from './dag-executor.js';
import { PlatformConfig } from '../../config/platform-config.js';

const PHI = 1.6180339887498948;

/**
 * PatternEngine — Provides 8 production multi-agent patterns as first-class citizens.
 *
 * Patterns absorbed from:
 *   - Google ADK: Sequential, Parallel, Hierarchical, Loop, Composite
 *   - LangGraph: Graph state machines with conditional branching + cycles
 *   - CrewAI: Role-based crew orchestration
 *   - AutoGen: Conversation-as-coordination GroupChat
 *   - OpenAI Swarm: Explicit handoffs
 *
 * Each pattern returns a configured DAGExecutor ready for execution.
 */
export class PatternEngine {
  /**
   * Pattern 1: Sequential Pipeline
   * Assembly line — each agent processes output of the previous.
   * Source: Google ADK SequentialAgent, CrewAI sequential process.
   *
   * @param {Array<{id: string, handler: Function}>} stages
   * @returns {DAGExecutor}
   */
  static sequential(stages) {
    const dag = new DAGExecutor();
    for (let i = 0; i < stages.length; i++) {
      dag.addNode(stages[i].id, stages[i].handler, stages[i].options);
      if (i > 0) {
        dag.addEdge(stages[i - 1].id, stages[i].id);
      }
    }
    return dag;
  }

  /**
   * Pattern 2: Parallel Fan-Out / Gather
   * Dispatcher sends task to N agents in parallel, synthesizer merges results.
   * Source: Google ADK ParallelAgent, LangGraph scatter-gather.
   *
   * @param {object} dispatcher — { id, handler }
   * @param {Array<{id: string, handler: Function}>} workers
   * @param {object} synthesizer — { id, handler }
   * @returns {DAGExecutor}
   */
  static parallelFanOut(dispatcher, workers, synthesizer) {
    const dag = new DAGExecutor({ maxParallel: workers.length });

    dag.addNode(dispatcher.id, dispatcher.handler, dispatcher.options);

    for (const worker of workers) {
      dag.addNode(worker.id, worker.handler, worker.options);
      dag.addEdge(dispatcher.id, worker.id);
      dag.addEdge(worker.id, synthesizer.id);
    }

    dag.addNode(synthesizer.id, synthesizer.handler, synthesizer.options);
    return dag;
  }

  /**
   * Pattern 3: Coordinator / Dispatcher (LLM-Routed)
   * A coordinator uses CSL routing to delegate to the best specialist.
   * Source: Google ADK coordinator, OpenAI Swarm handoffs.
   *
   * @param {object} coordinator — { id, handler } (routes via CSL score)
   * @param {Array<{id: string, handler: Function, domain: string}>} specialists
   * @returns {DAGExecutor}
   */
  static coordinatorDispatch(coordinator, specialists) {
    const dag = new DAGExecutor();

    dag.addNode(coordinator.id, coordinator.handler, coordinator.options);

    for (const specialist of specialists) {
      dag.addNode(specialist.id, specialist.handler, {
        ...specialist.options,
        // Conditional: only execute if coordinator selected this specialist
        condition: (state) => state._selectedSpecialist === specialist.id,
      });
      dag.addEdge(coordinator.id, specialist.id,
        (state) => state._selectedSpecialist === specialist.id
      );
    }

    return dag;
  }

  /**
   * Pattern 4: Hierarchical Decomposition
   * Top-level orchestrator breaks into sub-orchestrators, each with workers.
   * Source: Google ADK AgentTool wrapping, Puppeteer multi-agent hierarchical.
   *
   * @param {object} orchestrator — { id, handler }
   * @param {Array<{id: string, handler: Function, workers: Array}>} coordinators
   * @returns {DAGExecutor}
   */
  static hierarchical(orchestrator, coordinators) {
    const dag = new DAGExecutor();

    dag.addNode(orchestrator.id, orchestrator.handler, orchestrator.options);

    for (const coord of coordinators) {
      dag.addNode(coord.id, coord.handler, coord.options);
      dag.addEdge(orchestrator.id, coord.id);

      if (coord.workers) {
        for (const worker of coord.workers) {
          dag.addNode(worker.id, worker.handler, { ...worker.options, critical: false });
          dag.addEdge(coord.id, worker.id);
        }
      }
    }

    return dag;
  }

  /**
   * Pattern 5: Generator & Critic Loop
   * Generator produces output, critic validates, loops until pass or maxCycles.
   * Source: Google ADK LoopAgent with exit_condition.
   *
   * @param {object} generator — { id, handler }
   * @param {object} critic — { id, handler } — returns { pass: boolean, feedback }
   * @param {number} maxCycles — Max iterations (default: F(6) = 8)
   * @returns {DAGExecutor}
   */
  static generatorCritic(generator, critic, maxCycles = 8) {
    const dag = new DAGExecutor({ maxCycles });

    dag.addNode(generator.id, generator.handler, generator.options);
    dag.addNode(critic.id, critic.handler, critic.options);

    // Generator → Critic
    dag.addEdge(generator.id, critic.id);

    // Critic → Generator (cycle, conditional on failure)
    dag.addEdge(critic.id, generator.id, (state) => !state._criticPass);

    return dag;
  }

  /**
   * Pattern 6: Iterative Refinement
   * Single agent refines output across N iterations.
   * Source: Google ADK LoopAgent with max_iterations.
   *
   * @param {object} refiner — { id, handler }
   * @param {number} maxIterations — Max refinement cycles
   * @param {Function} exitCondition — (state) => boolean
   * @returns {DAGExecutor}
   */
  static iterativeRefinement(refiner, maxIterations = 5, exitCondition = null) {
    const dag = new DAGExecutor({ maxCycles: maxIterations });

    dag.addNode(refiner.id, refiner.handler, refiner.options);
    dag.addNode('__exit_check', async (state) => {
      const done = exitCondition ? exitCondition(state) : (state._refinementScore >= 0.882);
      return { _refinementDone: done };
    });

    dag.addEdge(refiner.id, '__exit_check');
    dag.addEdge('__exit_check', refiner.id, (state) => !state._refinementDone);

    return dag;
  }

  /**
   * Pattern 7: Human-in-the-Loop
   * Agent produces work, human gate interrupts for approval, then resumes.
   * Source: LangGraph interrupt()/resume, Google ADK ApprovalTool.
   *
   * @param {object} worker — { id, handler }
   * @param {object} gate — { id, validator: (state) => { approved, feedback } }
   * @param {object} finalizer — { id, handler }
   * @returns {DAGExecutor}
   */
  static humanInTheLoop(worker, gate, finalizer) {
    const dag = new DAGExecutor();

    dag.addNode(worker.id, worker.handler, worker.options);

    dag.addNode(gate.id, async (state, context) => {
      // Interrupt for human review
      dag.interrupt();
      return { _awaitingHumanApproval: true };
    });

    dag.addNode(finalizer.id, finalizer.handler, {
      ...finalizer.options,
      condition: (state) => state._humanApproved === true,
    });

    dag.addEdge(worker.id, gate.id);
    dag.addEdge(gate.id, finalizer.id, (state) => state._humanApproved);
    dag.addEdge(gate.id, worker.id, (state) => !state._humanApproved && state._humanFeedback);

    return dag;
  }

  /**
   * Pattern 8: Composite (Nested patterns)
   * Combine any of the above patterns into a unified DAG.
   * Source: Google ADK Composite pattern.
   *
   * @param {DAGExecutor[]} subGraphs — Array of sub-pattern DAGs
   * @param {string} mode — 'sequential' | 'parallel'
   * @returns {DAGExecutor}
   */
  static composite(subGraphs, mode = 'sequential') {
    const dag = new DAGExecutor({ maxParallel: subGraphs.length });

    // Wrap each sub-graph as a node
    for (let i = 0; i < subGraphs.length; i++) {
      const subId = `__composite_${i}`;
      dag.addNode(subId, async (state, context) => {
        const result = await subGraphs[i].execute(state, context);
        return result.state;
      });

      if (mode === 'sequential' && i > 0) {
        dag.addEdge(`__composite_${i - 1}`, subId);
      }
    }

    return dag;
  }

  /**
   * Pattern 9 (Heady-native): Race / Tournament
   * N agents compete on the same task; fastest/best result wins.
   * Source: Heady™ Battle Arena Mode.
   *
   * @param {Array<{id: string, handler: Function}>} competitors
   * @param {Function} judge — (results[]) => winnerId
   * @returns {DAGExecutor}
   */
  static race(competitors, judge) {
    const dag = new DAGExecutor({ maxParallel: competitors.length });

    const dispatcherId = '__race_dispatch';
    const judgeId = '__race_judge';

    dag.addNode(dispatcherId, async (state) => ({ _raceStarted: true }));

    for (const comp of competitors) {
      dag.addNode(comp.id, comp.handler, { ...comp.options, critical: false });
      dag.addEdge(dispatcherId, comp.id);
      dag.addEdge(comp.id, judgeId);
    }

    dag.addNode(judgeId, async (state) => {
      const results = competitors.map(c => ({
        id: c.id,
        result: state[`_race_${c.id}`],
      }));
      const winnerId = judge(results);
      return { _raceWinner: winnerId, _raceResults: results };
    });

    return dag;
  }
}
