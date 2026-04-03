# HEADY_BRAND:BEGIN
# ╔══════════════════════════════════════════════════════════════════╗
# ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
# ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
# ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
# ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
# ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
# ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
# ║                                                                  ║
# ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
# ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
# ║  FILE: src/heady_project/nlp_service.py                          ║
# ║  LAYER: backend/src                                              ║
# ╚══════════════════════════════════════════════════════════════════╝
# HEADY_BRAND:END

"""
NLP Service — Text generation, summarization, entity extraction,
and intent classification for the Heady ecosystem.
"""

from .utils import get_logger
from typing import Dict, List, Optional
import re

logger = get_logger(__name__)

# ═══════════════════════════════════════════════════════════════════
# Intent Classification
# ═══════════════════════════════════════════════════════════════════

INTENT_PATTERNS = {
    "pipeline_status": [r"status", r"how.*(pipeline|system)", r"what.*running"],
    "deploy": [r"deploy", r"push.*prod", r"ship"],
    "build": [r"build", r"compile", r"make"],
    "help": [r"help", r"how\s+do", r"explain", r"what\s+is"],
    "health": [r"health", r"check", r"diagnostic", r"monitor"],
    "audit": [r"audit", r"security", r"compliance"],
    "resource": [r"resource", r"cpu", r"memory", r"disk", r"gpu"],
}


def classify_intent(text: str) -> Dict[str, float]:
    """Classify user intent from natural language input."""
    text_lower = text.lower()
    scores: Dict[str, float] = {}

    for intent, patterns in INTENT_PATTERNS.items():
        matches = sum(1 for p in patterns if re.search(p, text_lower))
        if matches > 0:
            scores[intent] = matches / len(patterns)

    # Normalize scores
    total = sum(scores.values()) or 1.0
    return {k: round(v / total, 3) for k, v in sorted(scores.items(), key=lambda x: -x[1])}


# ═══════════════════════════════════════════════════════════════════
# Entity Extraction
# ═══════════════════════════════════════════════════════════════════

ENTITY_PATTERNS = {
    "file_path": r"[\w\-./]+\.\w{1,5}",
    "version": r"v?\d+\.\d+(?:\.\d+)?",
    "url": r"https?://\S+",
    "agent_name": r"\b(builder|researcher|deployer|auditor|observer|claude-code)\b",
    "stage": r"\b(ingest|plan|execute|recover|finalize)\b",
}


def extract_entities(text: str) -> Dict[str, List[str]]:
    """Extract named entities from text."""
    entities: Dict[str, List[str]] = {}
    for entity_type, pattern in ENTITY_PATTERNS.items():
        matches = re.findall(pattern, text, re.IGNORECASE)
        if matches:
            entities[entity_type] = list(set(matches))
    return entities


# ═══════════════════════════════════════════════════════════════════
# NLP Service Class
# ═══════════════════════════════════════════════════════════════════

class NLPService:
    """NLP processing service for Heady AI interactions."""

    def __init__(self):
        self.conversation_history: List[Dict] = []

    def generate_response(self, prompt: str, context: Optional[Dict] = None) -> str:
        """Generate a contextual response to a user prompt."""
        logger.info(f"Generating response for: {prompt[:50]}...")

        intent = classify_intent(prompt)
        entities = extract_entities(prompt)
        top_intent = next(iter(intent), "general")

        # Build response based on classified intent
        response = self._build_response(top_intent, prompt, entities, context)

        self.conversation_history.append({
            "role": "user", "content": prompt, "intent": intent, "entities": entities
        })
        self.conversation_history.append({
            "role": "assistant", "content": response
        })

        return response

    def _build_response(self, intent: str, prompt: str, entities: Dict, context: Optional[Dict]) -> str:
        """Build a response string based on intent."""
        responses = {
            "pipeline_status": "The HCFullPipeline is currently operational. Use the /api/pipeline/state endpoint for live status.",
            "deploy": "Deployment can be triggered via /api/pipeline/run or the Supervisor route endpoint.",
            "build": "Build operations are managed by the builder agent. The consolidated builder handles Node.js and Python dependencies.",
            "help": f"I can help with pipeline operations, deployment, monitoring, and code analysis. What specifically would you like to know?",
            "health": "Run health checks via /api/health or /api/health-checks/run for a comprehensive diagnostic.",
            "audit": "The audit system tracks all operations with integrity checksums. Use the auditor agent for security scans.",
            "resource": "Resource monitoring is available via /api/resources/health. HeadyBuddy shows live CPU, RAM, disk, and GPU metrics.",
        }

        base = responses.get(intent, f"Heady AI Response to: {prompt}")

        # Enrich with entity context
        if entities.get("agent_name"):
            base += f" (Referenced agents: {', '.join(entities['agent_name'])})"
        if entities.get("stage"):
            base += f" (Pipeline stages: {', '.join(entities['stage'])})"

        return base

    def summarize_text(self, text: str, max_sentences: int = 3) -> str:
        """Summarize text by extracting the most information-dense sentences."""
        logger.info("Summarizing text...")

        sentences = re.split(r'(?<=[.!?])\s+', text.strip())
        if len(sentences) <= max_sentences:
            return text

        # Score sentences by length and keyword density
        scored = []
        for s in sentences:
            words = s.split()
            keyword_count = sum(1 for w in words if len(w) > 5)
            score = len(words) * 0.3 + keyword_count * 0.7
            scored.append((score, s))

        scored.sort(key=lambda x: -x[0])
        top = scored[:max_sentences]

        # Preserve original order
        ordered = sorted(top, key=lambda x: sentences.index(x[1]))
        return " ".join(s for _, s in ordered)

    def analyze(self, text: str) -> Dict:
        """Full NLP analysis — intent, entities, summary."""
        return {
            "intent": classify_intent(text),
            "entities": extract_entities(text),
            "summary": self.summarize_text(text) if len(text) > 200 else text,
            "word_count": len(text.split()),
            "char_count": len(text),
        }


nlp_service = NLPService()
