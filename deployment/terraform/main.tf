# Heady Production — Terraform Configuration
# GCP Project: gen-lang-client-0920560496 | Region: us-east1

terraform {
  required_version = ">= 1.5"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
  backend "gcs" {
    bucket = "heady-terraform-state"
    prefix = "production"
  }
}

provider "google" {
  project = var.gcp_project_id
  region  = var.gcp_region
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

# ── Variables ──
variable "gcp_project_id" {
  default = "gen-lang-client-0920560496"
}

variable "gcp_region" {
  default = "us-east1"
}

variable "cloudflare_account_id" {
  default = "8b1fa38f282c691423c6399247d53323"
}

variable "cloudflare_api_token" {
  sensitive = true
}

# ── Cloud SQL (PostgreSQL + pgvector) ──
resource "google_sql_database_instance" "heady_db" {
  name             = "heady-production-db"
  database_version = "POSTGRES_16"
  region           = var.gcp_region

  settings {
    tier              = "db-custom-4-15360"
    availability_type = "REGIONAL"

    database_flags {
      name  = "shared_preload_libraries"
      value = "vector"
    }

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
      backup_retention_settings {
        retained_backups = 89  # fib(11)
      }
    }

    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.heady_vpc.id
    }
  }
}

# ── VPC Network ──
resource "google_compute_network" "heady_vpc" {
  name                    = "heady-production-vpc"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "heady_subnet" {
  name          = "heady-production-subnet"
  ip_cidr_range = "10.0.0.0/21"
  region        = var.gcp_region
  network       = google_compute_network.heady_vpc.id
}

# ── Cloud Run Services ──
# Dynamically create Cloud Run services for each microservice
locals {
  services = {
    "ai-router" = { port = 3310 }
    "analytics-service" = { port = 3311 }
    "api-gateway" = { port = 3312 }
    "asset-pipeline" = { port = 3313 }
    "auth-relay" = { port = 3314 }
    "auto-success-engine" = { port = 3315 }
    "billing-service" = { port = 3316 }
    "budget-tracker" = { port = 3317 }
    "cli-service" = { port = 3318 }
    "colab-gateway" = { port = 3319 }
    "discord-bot" = { port = 3320 }
    "domain-router" = { port = 3321 }
    "google-mcp" = { port = 3322 }
    # ... remaining 46 services follow same pattern
  }
}

resource "google_cloud_run_v2_service" "heady_services" {
  for_each = local.services

  name     = each.key
  location = var.gcp_region

  template {
    containers {
      image = "gcr.io/${var.gcp_project_id}/${each.key}:latest"
      ports {
        container_port = each.value.port
      }
      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }
      env {
        name  = "NODE_ENV"
        value = "production"
      }
      env {
        name  = "SERVICE_NAME"
        value = each.key
      }
    }
    scaling {
      min_instance_count = 1
      max_instance_count = 13  # fib(7)
    }
  }
}

# ── Redis (Memorystore) ──
resource "google_redis_instance" "heady_cache" {
  name           = "heady-production-cache"
  tier           = "STANDARD_HA"
  memory_size_gb = 8  # fib(6)
  region         = var.gcp_region
  redis_version  = "REDIS_7_0"

  authorized_network = google_compute_network.heady_vpc.id
}

# ── Artifact Registry ──
resource "google_artifact_registry_repository" "heady_containers" {
  location      = var.gcp_region
  repository_id = "heady-containers"
  format        = "DOCKER"
}
