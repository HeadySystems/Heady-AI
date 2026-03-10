################################################################################
# Heady™ Master Makefile
# Unified orchestration of build, test, deploy, and Docker operations
################################################################################

.PHONY: help start start-http start-sse test validate docker-build docker-up \
        docker-down docker-logs docker-status clean bootstrap build smoke predeploy

# Color output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[1;33m
NC := \033[0m

################################################################################
# Core Targets
################################################################################

help:
	@echo "$(BLUE)╔════════════════════════════════════════════════════════════╗$(NC)"
	@echo "$(BLUE)║$(NC) Heady™ Master Control Program - Make Targets$(NC)"
	@echo "$(BLUE)╚════════════════════════════════════════════════════════════╝$(NC)"
	@echo ""
	@echo "$(BLUE)Startup Targets:$(NC)"
	@echo "  $(GREEN)start$(NC)              Start MCP server (stdio transport)"
	@echo "  $(GREEN)start-http$(NC)         Start MCP server (HTTP transport)"
	@echo "  $(GREEN)start-sse$(NC)          Start MCP server (SSE transport)"
	@echo ""
	@echo "$(BLUE)Validation & Testing:$(NC)"
	@echo "  $(GREEN)test$(NC)               Run all tests"
	@echo "  $(GREEN)validate$(NC)           Validate all required files and syntax"
	@echo "  $(GREEN)smoke$(NC)              Run smoke tests"
	@echo ""
	@echo "$(BLUE)Docker Targets:$(NC)"
	@echo "  $(GREEN)docker-build$(NC)       Build Docker image for MCP server"
	@echo "  $(GREEN)docker-up$(NC)          Start all services with docker-compose"
	@echo "  $(GREEN)docker-down$(NC)        Stop all docker-compose services"
	@echo "  $(GREEN)docker-logs$(NC)        View docker container logs"
	@echo "  $(GREEN)docker-status$(NC)      Show Docker container status"
	@echo ""
	@echo "$(BLUE)Build Targets:$(NC)"
	@echo "  $(GREEN)bootstrap$(NC)          Install dependencies with pnpm"
	@echo "  $(GREEN)build$(NC)              Build the project"
	@echo "  $(GREEN)predeploy$(NC)          Run pre-deployment checks"
	@echo ""
	@echo "$(BLUE)Maintenance:$(NC)"
	@echo "  $(GREEN)clean$(NC)              Clean node_modules and build artifacts"
	@echo "  $(GREEN)help$(NC)               Display this help message"
	@echo ""
	@echo "$(BLUE)Examples:$(NC)"
	@echo "  make start                # Start server with stdio"
	@echo "  make docker-up            # Start services with Docker"
	@echo "  make validate && make test # Validate then test"
	@echo ""

################################################################################
# Startup Targets
################################################################################

start:
	@echo "$(BLUE)[→]$(NC) Starting Heady™ MCP Server (stdio transport)..."
	@chmod +x ./scripts/heady-start.sh
	@./scripts/heady-start.sh stdio

start-http:
	@echo "$(BLUE)[→]$(NC) Starting Heady™ MCP Server (HTTP transport)..."
	@chmod +x ./scripts/heady-start.sh
	@./scripts/heady-start.sh http

start-sse:
	@echo "$(BLUE)[→]$(NC) Starting Heady™ MCP Server (SSE transport)..."
	@chmod +x ./scripts/heady-start.sh
	@./scripts/heady-start.sh sse

################################################################################
# Validation & Testing Targets
################################################################################

test:
	@echo "$(BLUE)[→]$(NC) Running all tests..."
	pnpm test

validate:
	@echo "$(BLUE)[→]$(NC) Validating Heady™ configuration..."
	@chmod +x ./scripts/heady-validate.sh
	@./scripts/heady-validate.sh

smoke:
	@echo "$(BLUE)[→]$(NC) Running smoke tests..."
	pnpm smoke

################################################################################
# Docker Targets
################################################################################

docker-build:
	@echo "$(BLUE)[→]$(NC) Building Docker image for MCP server..."
	@chmod +x ./scripts/heady-docker.sh
	@./scripts/heady-docker.sh build

docker-up:
	@echo "$(BLUE)[→]$(NC) Starting services with docker-compose..."
	docker-compose -f docker-compose.mcp.yml up -d
	@echo "$(GREEN)[✓]$(NC) Services started"
	@echo "  MCP Server:   http://localhost:3310"
	@echo "  Brain:        http://localhost:3311"
	@echo "  Memory:       http://localhost:3312"

docker-down:
	@echo "$(BLUE)[→]$(NC) Stopping docker-compose services..."
	docker-compose -f docker-compose.mcp.yml down
	@echo "$(GREEN)[✓]$(NC) Services stopped"

docker-logs:
	@echo "$(BLUE)[→]$(NC) Viewing Docker logs..."
	@chmod +x ./scripts/heady-docker.sh
	@./scripts/heady-docker.sh logs

docker-status:
	@echo "$(BLUE)[→]$(NC) Checking Docker status..."
	@chmod +x ./scripts/heady-docker.sh
	@./scripts/heady-docker.sh status

docker-health:
	@echo "$(BLUE)[→]$(NC) Running health checks..."
	@chmod +x ./scripts/heady-docker.sh
	@./scripts/heady-docker.sh health

################################################################################
# Build Targets
################################################################################

bootstrap:
	@echo "$(BLUE)[→]$(NC) Installing dependencies with pnpm..."
	pnpm install

build:
	@echo "$(BLUE)[→]$(NC) Building the project..."
	pnpm build

predeploy:
	@echo "$(BLUE)[→]$(NC) Running pre-deployment checks..."
	pnpm predeploy

################################################################################
# Maintenance Targets
################################################################################

clean:
	@echo "$(BLUE)[→]$(NC) Cleaning build artifacts..."
	@rm -rf node_modules dist coverage logs
	@rm -rf services/heady-mcp-server/node_modules
	@echo "$(GREEN)[✓]$(NC) Clean complete"

################################################################################
# Compound Targets
################################################################################

.DEFAULT_GOAL := help
