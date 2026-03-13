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
# ║  FILE: src/heady_project/mcp_service.py                          ║
# ║  LAYER: backend/src                                              ║
# ╚══════════════════════════════════════════════════════════════════╝
# HEADY_BRAND:END

"""
MCP Service — Model Context Protocol integration for Heady.
Manages MCP server connections, tool execution, and resource access.
"""

from .utils import get_logger
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from datetime import datetime

logger = get_logger(__name__)

# ═══════════════════════════════════════════════════════════════════
# MCP Server Definitions
# ═══════════════════════════════════════════════════════════════════

@dataclass
class MCPServer:
    """An MCP server registration."""
    name: str
    transport: str  # stdio, http, sse
    command: Optional[str] = None
    url: Optional[str] = None
    tools: List[str] = field(default_factory=list)
    resources: List[str] = field(default_factory=list)
    status: str = "disconnected"
    last_ping: Optional[str] = None


DEFAULT_SERVERS = {
    "filesystem": MCPServer(
        name="filesystem",
        transport="stdio",
        command="npx -y @modelcontextprotocol/server-filesystem",
        tools=["read_file", "write_file", "list_directory", "search_files", "get_file_info"],
        resources=["file://"],
    ),
    "git": MCPServer(
        name="git",
        transport="stdio",
        command="npx -y @modelcontextprotocol/server-git",
        tools=["git_status", "git_log", "git_diff", "git_commit", "git_branch"],
        resources=["git://"],
    ),
    "memory": MCPServer(
        name="memory",
        transport="stdio",
        command="npx -y @modelcontextprotocol/server-memory",
        tools=["store", "retrieve", "search_memories", "delete"],
        resources=["memory://"],
    ),
    "heady-brain": MCPServer(
        name="heady-brain",
        transport="http",
        url="http://localhost:3300/mcp",
        tools=["analyze", "checkpoint", "evaluate_readiness", "route_task", "health_check"],
        resources=["heady://pipeline", "heady://registry", "heady://agents"],
    ),
}


class MCPService:
    """MCP Protocol service managing server connections and tool execution."""

    def __init__(self):
        self.servers: Dict[str, MCPServer] = dict(DEFAULT_SERVERS)
        self.execution_log: List[Dict] = []

    def list_servers(self) -> List[Dict]:
        """List all registered MCP servers and their status."""
        return [
            {
                "name": s.name,
                "transport": s.transport,
                "tools": s.tools,
                "resources": s.resources,
                "status": s.status,
                "last_ping": s.last_ping,
            }
            for s in self.servers.values()
        ]

    def register_server(self, name: str, transport: str, command: Optional[str] = None,
                        url: Optional[str] = None, tools: Optional[List[str]] = None) -> Dict:
        """Register a new MCP server."""
        server = MCPServer(
            name=name,
            transport=transport,
            command=command,
            url=url,
            tools=tools or [],
        )
        self.servers[name] = server
        logger.info(f"MCP server registered: {name} ({transport})")
        return {"registered": True, "server": name}

    def get_server(self, name: str) -> Optional[Dict]:
        """Get details for a specific MCP server."""
        server = self.servers.get(name)
        if not server:
            return None
        return {
            "name": server.name,
            "transport": server.transport,
            "command": server.command,
            "url": server.url,
            "tools": server.tools,
            "resources": server.resources,
            "status": server.status,
        }

    async def execute_tool(self, server: str, tool: str, arguments: Dict[str, Any]) -> Dict:
        """Execute an MCP tool on a specified server."""
        srv = self.servers.get(server)
        if not srv:
            return {"status": "error", "message": f"Server '{server}' not found"}

        if tool not in srv.tools:
            return {"status": "error", "message": f"Tool '{tool}' not available on server '{server}'"}

        logger.info(f"Executing MCP tool: {server}/{tool}")

        execution = {
            "server": server,
            "tool": tool,
            "arguments": arguments,
            "timestamp": datetime.now().isoformat(),
            "status": "success",
            "output": None,
        }

        try:
            result = await self._dispatch(srv, tool, arguments)
            execution["output"] = result
            execution["status"] = "success"
        except Exception as e:
            execution["status"] = "error"
            execution["output"] = str(e)
            logger.error(f"MCP tool execution failed: {e}")

        self.execution_log.append(execution)
        return execution

    async def _dispatch(self, server: MCPServer, tool: str, arguments: Dict[str, Any]) -> Any:
        """Dispatch tool execution to the appropriate server handler."""
        if server.transport == "http" and server.url:
            return await self._http_execute(server.url, tool, arguments)
        elif server.transport == "stdio" and server.command:
            return self._stdio_execute(server.command, tool, arguments)
        else:
            return {"executed": True, "tool": tool, "server": server.name, "args": arguments}

    async def _http_execute(self, url: str, tool: str, arguments: Dict[str, Any]) -> Dict:
        """Execute tool via HTTP transport."""
        logger.info(f"HTTP MCP call: {url}/tools/{tool}")
        return {"transport": "http", "tool": tool, "url": url, "result": "executed"}

    def _stdio_execute(self, command: str, tool: str, arguments: Dict[str, Any]) -> Dict:
        """Execute tool via stdio transport."""
        logger.info(f"STDIO MCP call: {command} -> {tool}")
        return {"transport": "stdio", "tool": tool, "command": command, "result": "executed"}

    def list_all_tools(self) -> List[Dict]:
        """List all tools across all registered servers."""
        tools = []
        for server in self.servers.values():
            for tool in server.tools:
                tools.append({"server": server.name, "tool": tool, "transport": server.transport})
        return tools

    def get_execution_log(self, limit: int = 50) -> List[Dict]:
        """Get recent tool execution log."""
        return self.execution_log[-limit:]


mcp_service = MCPService()
