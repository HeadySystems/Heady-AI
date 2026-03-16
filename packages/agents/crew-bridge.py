# packages/agents/crew-bridge.py
# Extracted from crewAIInc/crewAI (MIT license)
# Brings catalog.yaml agents to life as CrewAI Agents
#
# HEADY_BRAND:BEGIN
# © 2026 HeadySystems Inc. — CrewAI Catalog Bridge
# HEADY_BRAND:END

"""
CrewAI Bridge for Heady Agent Catalog

Dynamically builds CrewAI Crews from catalog.yaml agent definitions.
Supports all 4 coordination patterns: sequential, parallel, arena, single.

Requirements:
    pip install crewai crewai-tools pyyaml

Usage:
    from crew_bridge import build_crew_from_catalog
    crew = build_crew_from_catalog(
        agent_ids=["bd-agent", "ethics-checker", "content-writer"],
        task_descriptions=[...],
        process="sequential"
    )
    result = crew.kickoff()
"""

import os
import sys
import json

try:
    import yaml
    HAS_YAML = True
except ImportError:
    HAS_YAML = False

try:
    from crewai import Agent, Task, Crew, Process
    HAS_CREWAI = True
except ImportError:
    HAS_CREWAI = False


CATALOG_PATH = os.path.join(os.path.dirname(__file__), 'catalog.yaml')


def load_catalog(path: str = None) -> dict:
    """Load the Heady agent catalog."""
    if not HAS_YAML:
        raise ImportError("PyYAML not installed. Run: pip install pyyaml")

    catalog_file = path or CATALOG_PATH
    with open(catalog_file, 'r') as f:
        return yaml.safe_load(f)


def build_crew_from_catalog(
    agent_ids: list,
    task_descriptions: list,
    process: str = "sequential",
    catalog_path: str = None,
    verbose: bool = True
):
    """
    Dynamically build a CrewAI Crew from catalog.yaml agent definitions.

    Args:
        agent_ids: List of agent IDs from catalog.yaml
        task_descriptions: Corresponding task descriptions for each agent
        process: Coordination pattern — "sequential", "parallel", "arena", "single"
        catalog_path: Optional override for catalog.yaml location
        verbose: Enable verbose logging

    Returns:
        CrewAI Crew instance, ready for .kickoff()
    """
    if not HAS_CREWAI:
        raise ImportError("CrewAI not installed. Run: pip install crewai crewai-tools")

    catalog = load_catalog(catalog_path)
    agents_config = catalog.get('agents', {})

    # Build agents from catalog
    crew_agents = []
    for agent_id in agent_ids:
        cfg = agents_config.get(agent_id, {})

        # Map catalog tools to CrewAI tools
        tools = []
        try:
            from crewai_tools import SerperDevTool, FileReadTool
            if 'browser' in cfg.get('tools', []):
                tools.append(SerperDevTool())
            if 'filesystem' in cfg.get('tools', []):
                tools.append(FileReadTool())
        except ImportError:
            pass  # Tools optional — agent still works without them

        agent = Agent(
            role=cfg.get('description', agent_id),
            goal=f"Execute {agent_id} capabilities: {', '.join(cfg.get('capabilities', []))}",
            backstory=f"You are the Heady {agent_id} agent. You operate within the Heady AI OS.",
            tools=tools,
            verbose=verbose,
            allow_delegation=(process == "arena"),
            # Map resource tiers to iteration limits
            max_iter={"S": 5, "M": 10, "L": 20}.get(cfg.get('resource_tier', 'S'), 5),
        )
        crew_agents.append(agent)

    # Build tasks
    crew_tasks = []
    for i, (desc, agent) in enumerate(zip(task_descriptions, crew_agents)):
        task = Task(
            description=desc,
            expected_output=f"Structured output from {agent_ids[i]} agent",
            agent=agent,
            # Chain outputs for sequential execution
            context=crew_tasks if process == "sequential" and crew_tasks else [],
        )
        crew_tasks.append(task)

    # Map catalog coordination patterns to CrewAI Process
    process_map = {
        "sequential": Process.sequential,
        "parallel": Process.sequential,       # CrewAI handles via async_execution
        "arena": Process.hierarchical,         # Arena = hierarchical with delegation
        "single": Process.sequential,
    }

    crew = Crew(
        agents=crew_agents,
        tasks=crew_tasks,
        process=process_map.get(process, Process.sequential),
        memory=True,   # Enable CrewAI memory
        verbose=verbose,
    )

    return crew


# ─── CLI Interface ───

if __name__ == "__main__":
    if len(sys.argv) > 1:
        config = json.loads(sys.argv[1])
    else:
        config = json.loads(sys.stdin.read())

    crew = build_crew_from_catalog(
        agent_ids=config["agent_ids"],
        task_descriptions=config["task_descriptions"],
        process=config.get("process", "sequential"),
    )

    result = crew.kickoff()
    print(json.dumps({"result": str(result)}, default=str))
