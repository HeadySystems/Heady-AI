# ══════════════════════════════════════════════════════════════════
# Heady Liquid Architecture — Terraform Variables
# ══════════════════════════════════════════════════════════════════

variable "project_id" {
  description = "GCP project ID for the Heady infrastructure"
  type        = string
  default     = "heady-ai"

  validation {
    condition     = var.project_id == "heady-ai"
    error_message = "The live rebuild successor project is heady-ai; legacy and nominal project IDs are not deployment targets."
  }
}

variable "region" {
  description = "GCP region for all resources"
  type        = string
  default     = "us-east1"

  validation {
    condition     = var.region == "us-east1"
    error_message = "ADR-0022 locks production deployment to us-east1."
  }
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "production"
}

variable "orchestrator_image" {
  description = "Docker image URL for the swarm orchestrator"
  type        = string
  default     = "us-east1-docker.pkg.dev/heady-ai/heady-docker-repo/heady-orchestrator:latest"
}
