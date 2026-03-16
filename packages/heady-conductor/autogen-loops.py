# packages/heady-conductor/autogen-loops.py
# Extracted from microsoft/autogen (MIT license)
# Powers HeadyQA self-correction loops
#
# HEADY_BRAND:BEGIN
# © 2026 HeadySystems Inc. — AutoGen QA Self-Correction Loops
# HEADY_BRAND:END

"""
AutoGen Multi-Agent Self-Correction Loops for HeadyQA.

Pattern: Generator → Critic → Corrections → APPROVED
Runs until critic approves or max rounds reached.

Requirements:
    pip install autogen-agentchat

Usage:
    from autogen_loops import create_heady_qa_loop
    result = create_heady_qa_loop("Write a REST API for user management")
"""

import os
import sys
import json

try:
    from autogen import AssistantAgent, UserProxyAgent, GroupChat, GroupChatManager
    HAS_AUTOGEN = True
except ImportError:
    HAS_AUTOGEN = False


def get_llm_config(model: str = None) -> dict:
    """Build LLM config from environment."""
    return {
        "model": model or os.environ.get("AUTOGEN_MODEL", "gpt-4.1"),
        "api_key": os.environ["OPENAI_API_KEY"],
        "timeout": 60,
    }


def create_heady_qa_loop(task: str, model: str = None, max_rounds: int = 6) -> str:
    """
    Creates a HeadyQA self-correction loop.

    Agent generates → Critic reviews → Agent corrects → Approved.

    Args:
        task: The task to generate and review
        model: LLM model to use (default: gpt-4.1)
        max_rounds: Maximum conversation rounds before forced stop

    Returns:
        Final approved output as string
    """
    if not HAS_AUTOGEN:
        raise ImportError("AutoGen not installed. Run: pip install autogen-agentchat")

    llm_config = get_llm_config(model)

    # Generator agent (HeadyBuddy role)
    generator = AssistantAgent(
        name="HeadyGenerator",
        system_message="""You are HeadyGenerator. Generate high-quality, production-grade code and responses.
After receiving feedback from HeadyQA, refine your output to address every concern.
Continue until the critic approves with 'APPROVED'.
Never produce stubs, placeholders, or TODO comments.""",
        llm_config=llm_config,
    )

    # Critic agent (HeadyQA role)
    critic = AssistantAgent(
        name="HeadyQA",
        system_message="""You are HeadyQA — the quality assurance agent for Heady.
Review all outputs rigorously for:
  1. Factual accuracy and completeness
  2. Code correctness (compiles, handles errors, no stubs)
  3. Security (no hardcoded secrets, proper validation)
  4. Heady brand and architecture alignment
  5. Production readiness (structured logs, health checks, typed errors)

If ALL criteria pass, reply with exactly: APPROVED
Otherwise, provide specific, actionable improvement items.""",
        llm_config=llm_config,
    )

    # Executor (HeadyCorrections role — applies fixes)
    executor = UserProxyAgent(
        name="HeadyCorrections",
        human_input_mode="NEVER",
        code_execution_config={"work_dir": "/tmp/heady_qa", "use_docker": False},
        max_consecutive_auto_reply=3,
    )

    group_chat = GroupChat(
        agents=[generator, critic, executor],
        messages=[],
        max_round=max_rounds,
        speaker_selection_method="round_robin",
    )

    manager = GroupChatManager(
        groupchat=group_chat,
        llm_config=llm_config,
    )

    executor.initiate_chat(manager, message=task)

    # Return the last message content
    if group_chat.messages:
        return group_chat.messages[-1].get("content", "")
    return ""


def create_code_review_loop(code: str, language: str = "typescript") -> str:
    """
    Specialized code review loop — reviews code against Heady engineering standards.

    Args:
        code: Source code to review
        language: Programming language

    Returns:
        Review result or improved code
    """
    task = f"""Review the following {language} code against Heady engineering standards:
- Typed errors (statusCode, code, message, isOperational)
- Configuration validation at startup
- Structured JSON logging with correlation IDs
- /health endpoint with dependency status
- Graceful shutdown handlers
- No hardcoded environment values
- No empty catch blocks

Code to review:
```{language}
{code}
```

Provide specific improvements or reply APPROVED if all standards are met."""

    return create_heady_qa_loop(task)


# ─── CLI Interface ───

if __name__ == "__main__":
    if len(sys.argv) > 1:
        config = json.loads(sys.argv[1])
    else:
        config = json.loads(sys.stdin.read())

    action = config.get("action", "qa")

    if action == "qa":
        result = create_heady_qa_loop(
            task=config["task"],
            model=config.get("model"),
            max_rounds=config.get("max_rounds", 6),
        )
    elif action == "review":
        result = create_code_review_loop(
            code=config["code"],
            language=config.get("language", "typescript"),
        )
    else:
        result = f"Unknown action: {action}"

    print(json.dumps({"result": result}, default=str))
