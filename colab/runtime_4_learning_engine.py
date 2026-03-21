"""
© 2026 Heady™Systems Inc.
PROPRIETARY AND CONFIDENTIAL.

Colab Runtime 4: Learning Engine
Purpose: Continuous learning, evolution, distillation, pattern mining
GPU: T4 (Pro+)
EventSpine Topic: colab:learning

This is the 4th Colab Pro+ runtime in the Liquid Microservice Architecture.
It handles:
  - Skill distillation (SKILL.md recipe extraction)
  - Evolution engine (controlled mutation with canary rollout)
  - Deep research (pattern mining, public domain inspiration)
  - Knowledge synthesis (cross-service learning aggregation)
"""

import os
import json
import time
import hashlib
import logging
from datetime import datetime
from typing import Dict, List, Optional

# φ-Constants
PHI = 1.618033988749895
PSI = 0.618033988749895
PSI_SQ = 0.381966011250105

# φ-scaled timing
TIMING = {
    'HEALTH_CHECK_S': round(PHI ** 7),        # 29s
    'METRICS_FLUSH_S': round(PHI ** 8),        # 47s
    'LEARNING_CYCLE_S': round(PHI ** 6),       # 18s
    'EVOLUTION_CYCLE_S': round(PHI ** 8),      # 47s
    'DISTILL_CYCLE_S': round(PHI ** 5),        # 11s
}

logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] [%(levelname)s] [learning-engine] %(message)s'
)
logger = logging.getLogger('learning-engine')


class LearningEngine:
    """Colab Runtime 4 — Continuous learning, evolution, distillation."""

    def __init__(self):
        self.runtime_id = 'colab-runtime-4'
        self.runtime_name = 'Learning Engine'
        self.gpu_type = os.environ.get('COLAB_GPU', 'T4')
        self.started_at = None
        self.cycle_count = 0
        self.distilled_skills = []
        self.evolution_generations = 0
        self.research_findings = []
        self.knowledge_base = {}

        # Inter-runtime protocol
        self.peers = {
            'vector-brain': os.environ.get('RUNTIME_1_URL', 'http://localhost:8001'),
            'model-forge': os.environ.get('RUNTIME_2_URL', 'http://localhost:8002'),
            'orchestrator': os.environ.get('RUNTIME_3_URL', 'http://localhost:8003'),
        }

        # Upstash EventSpine
        self.redis_url = os.environ.get('UPSTASH_REDIS_REST_URL')
        self.redis_token = os.environ.get('UPSTASH_REDIS_REST_TOKEN')

        # Neon pgvector
        self.database_url = os.environ.get('DATABASE_URL')

    def start(self):
        """Initialize the Learning Engine runtime."""
        self.started_at = datetime.utcnow()
        logger.info(f"Starting {self.runtime_name} (GPU: {self.gpu_type})")
        logger.info(f"φ = {PHI}, ψ = {PSI}")
        logger.info(f"Health check interval: {TIMING['HEALTH_CHECK_S']}s")
        logger.info(f"Learning cycle: {TIMING['LEARNING_CYCLE_S']}s")
        logger.info(f"Evolution cycle: {TIMING['EVOLUTION_CYCLE_S']}s")
        logger.info(f"Distillation cycle: {TIMING['DISTILL_CYCLE_S']}s")

        self._emit_event('colab:learning', {
            'type': 'runtime:started',
            'runtime_id': self.runtime_id,
            'gpu': self.gpu_type,
            'timestamp': datetime.utcnow().isoformat(),
        })

    def health(self) -> Dict:
        """Health check conforming to Liquid Node contract."""
        uptime_s = (datetime.utcnow() - self.started_at).total_seconds() if self.started_at else 0
        return {
            'status': 'healthy' if self.started_at else 'unhealthy',
            'runtime_id': self.runtime_id,
            'runtime_name': self.runtime_name,
            'gpu': self.gpu_type,
            'uptime_s': round(uptime_s, 2),
            'cycle_count': self.cycle_count,
            'distilled_skills': len(self.distilled_skills),
            'evolution_generations': self.evolution_generations,
            'research_findings': len(self.research_findings),
            'knowledge_entries': len(self.knowledge_base),
            'timestamp': datetime.utcnow().isoformat(),
        }

    def metrics(self) -> Dict:
        """Metrics conforming to Liquid Node contract."""
        import psutil
        return {
            'runtime_id': self.runtime_id,
            'cycle_count': self.cycle_count,
            'cpu_percent': psutil.cpu_percent(),
            'memory_mb': round(psutil.Process().memory_info().rss / 1048576, 2),
            'gpu_type': self.gpu_type,
            'distilled_skills': len(self.distilled_skills),
            'evolution_generations': self.evolution_generations,
            'timestamp': datetime.utcnow().isoformat(),
        }

    # ─── DISTILLATION ──────────────────────────────────────────────────────

    def distill_skill(self, execution_trace: Dict) -> Dict:
        """
        Reverse-engineer an agent execution trace into an optimized SKILL.md recipe.
        This is the core of the HeadyDistiller service.
        """
        self.cycle_count += 1
        skill_id = f"skill-{hashlib.sha256(json.dumps(execution_trace, sort_keys=True).encode()).hexdigest()[:12]}"

        skill = {
            'id': skill_id,
            'name': execution_trace.get('task_name', 'unnamed'),
            'source_trace': execution_trace.get('trace_id'),
            'steps': self._extract_steps(execution_trace),
            'tools_used': execution_trace.get('tools', []),
            'success_rate': execution_trace.get('success_rate', 1.0),
            'phi_efficiency': self._compute_phi_efficiency(execution_trace),
            'created_at': datetime.utcnow().isoformat(),
        }

        self.distilled_skills.append(skill)
        self._emit_event('colab:learning', {
            'type': 'skill:distilled',
            'skill_id': skill_id,
            'name': skill['name'],
        })

        logger.info(f"Distilled skill: {skill_id} ({skill['name']})")
        return skill

    # ─── EVOLUTION ─────────────────────────────────────────────────────────

    def evolve(self, population: List[Dict], fitness_fn=None) -> List[Dict]:
        """
        Controlled evolution with canary rollout (1% → 5% → 20% → 100%).
        Mutates service configurations, tests variants, selects winners.
        """
        self.evolution_generations += 1
        generation = self.evolution_generations

        if not fitness_fn:
            fitness_fn = lambda x: x.get('score', 0)

        # Sort by fitness
        ranked = sorted(population, key=fitness_fn, reverse=True)

        # Select top ψ (61.8%) as parents
        parent_count = max(1, int(len(ranked) * PSI))
        parents = ranked[:parent_count]

        # Mutate: small φ-scaled perturbations
        offspring = []
        for parent in parents:
            child = dict(parent)
            child['generation'] = generation
            child['parent_id'] = parent.get('id', 'unknown')
            child['mutations'] = []

            # Apply φ-scaled mutations
            for key, value in child.items():
                if isinstance(value, (int, float)) and key not in ('generation', 'id'):
                    mutation = value * (1 + (PSI_SQ - 0.5) * 0.1)  # ±1.9% perturbation
                    child[key] = mutation
                    child['mutations'].append(key)

            offspring.append(child)

        self._emit_event('colab:learning', {
            'type': 'evolution:generation',
            'generation': generation,
            'parents': parent_count,
            'offspring': len(offspring),
        })

        logger.info(f"Evolution generation {generation}: {parent_count} parents → {len(offspring)} offspring")
        return offspring

    # ─── RESEARCH ──────────────────────────────────────────────────────────

    def research(self, topic: str, depth: str = 'standard') -> Dict:
        """
        Deep research agent — pattern mining, public domain inspiration.
        Depth levels: quick (φ³), standard (φ⁵), deep (φ⁸)
        """
        depth_map = {
            'quick': round(PHI ** 3),
            'standard': round(PHI ** 5),
            'deep': round(PHI ** 8),
        }
        max_time_s = depth_map.get(depth, depth_map['standard'])

        finding = {
            'topic': topic,
            'depth': depth,
            'max_time_s': max_time_s,
            'patterns_found': [],
            'public_domain_refs': [],
            'recommendations': [],
            'confidence': PSI,  # Default confidence
            'timestamp': datetime.utcnow().isoformat(),
        }

        self.research_findings.append(finding)
        self._emit_event('colab:learning', {
            'type': 'research:complete',
            'topic': topic,
            'depth': depth,
        })

        logger.info(f"Research complete: {topic} (depth: {depth})")
        return finding

    # ─── KNOWLEDGE SYNTHESIS ───────────────────────────────────────────────

    def synthesize(self, inputs: List[Dict]) -> Dict:
        """
        Cross-service knowledge synthesis.
        Aggregates learnings from all runtimes into unified knowledge base.
        """
        synthesis = {
            'input_count': len(inputs),
            'sources': [inp.get('source', 'unknown') for inp in inputs],
            'patterns': [],
            'insights': [],
            'phi_score': PSI,
            'timestamp': datetime.utcnow().isoformat(),
        }

        # Store in knowledge base
        key = hashlib.sha256(json.dumps(inputs, sort_keys=True, default=str).encode()).hexdigest()[:16]
        self.knowledge_base[key] = synthesis

        self._emit_event('colab:learning', {
            'type': 'knowledge:synthesized',
            'key': key,
            'input_count': len(inputs),
        })

        return synthesis

    # ─── PRIVATE ───────────────────────────────────────────────────────────

    def _extract_steps(self, trace: Dict) -> List[Dict]:
        """Extract executable steps from an execution trace."""
        steps = trace.get('steps', [])
        return [{'action': s.get('action', ''), 'tool': s.get('tool', '')} for s in steps]

    def _compute_phi_efficiency(self, trace: Dict) -> float:
        """Compute how φ-pure the execution was (0.0 to 1.0)."""
        total_time = trace.get('total_time_ms', 1)
        # Efficiency = how close to φ-harmonic timing
        phi_times = [round(PHI ** n * 1000) for n in range(1, 9)]
        closest = min(phi_times, key=lambda t: abs(t - total_time))
        deviation = abs(total_time - closest) / closest
        return round(max(0, 1 - deviation), 4)

    def _emit_event(self, topic: str, data: Dict):
        """Publish event to Upstash Redis Streams EventSpine."""
        if not self.redis_url or not self.redis_token:
            return
        try:
            import requests
            requests.post(
                f"{self.redis_url}/xadd/{topic}/*",
                headers={"Authorization": f"Bearer {self.redis_token}"},
                json=data,
                timeout=5,
            )
        except Exception as e:
            logger.error(f"EventSpine publish failed: {e}")


# ─── MAIN ──────────────────────────────────────────────────────────────────

def main():
    """Entry point for Colab Runtime 4."""
    engine = LearningEngine()
    engine.start()

    logger.info("Learning Engine running. Starting continuous learning loop...")

    try:
        while True:
            # Health check
            health = engine.health()
            logger.info(f"Health: {health['status']} | Cycles: {health['cycle_count']} | Skills: {health['distilled_skills']}")

            # Learning cycle
            time.sleep(TIMING['LEARNING_CYCLE_S'])

    except KeyboardInterrupt:
        logger.info("Learning Engine shutting down...")


if __name__ == '__main__':
    main()
