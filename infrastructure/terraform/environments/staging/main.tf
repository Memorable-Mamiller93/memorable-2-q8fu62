# Provider and Backend Configuration
# AWS Provider version ~> 5.0
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }

  backend "s3" {
    bucket         = "memorable-terraform-state"
    key            = "staging/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "memorable-terraform-locks"
  }
}

# AWS Provider Configuration for Staging
provider "aws" {
  region = "us-east-1"

  default_tags {
    tags = local.common_tags
  }

  # Staging-specific provider settings
  retry_mode = "standard"
  max_retries = 10
}

# Local Variables
locals {
  environment = "staging"
  common_tags = {
    Environment   = "staging"
    Project       = "Memorable"
    ManagedBy    = "Terraform"
    CostCenter   = "staging-infrastructure"
    AutoShutdown = "true"
  }

  # Staging-specific resource configurations
  staging_config = {
    multi_az_enabled     = false
    backup_retention     = 7
    instance_count      = 2
    monitoring_interval = 60
  }
}

# Random ID for unique resource naming
resource "random_id" "staging" {
  byte_length = 4
}

# Networking Module - Single Region Configuration
module "networking" {
  source = "../../modules/networking"

  environment         = local.environment
  vpc_cidr           = var.vpc_cidr
  availability_zones = ["us-east-1a", "us-east-1b"]  # Reduced AZs for staging

  subnet_configuration = {
    public_subnets  = ["10.0.1.0/24", "10.0.2.0/24"]
    private_subnets = ["10.0.3.0/24", "10.0.4.0/24"]
  }

  tags = local.common_tags
}

# Compute Module - Staging Optimized
module "compute" {
  source = "../../modules/compute"

  environment     = local.environment
  vpc_id         = module.networking.vpc_id
  private_subnets = module.networking.private_subnets

  instance_types = {
    web     = var.instance_types.web_instance_type
    api     = var.instance_types.api_instance_type
    service = var.instance_types.service_instance_type
  }

  ecs_config = {
    cluster_name     = "memorable-staging-${random_id.staging.hex}"
    capacity_providers = ["FARGATE", "FARGATE_SPOT"]
    container_insights = true
  }

  autoscaling = {
    min_capacity     = 1
    max_capacity     = 4
    target_cpu      = 70
    target_memory   = 80
    scale_in_cooldown  = 300
    scale_out_cooldown = 180
  }

  tags = local.common_tags
}

# Database Module - Staging Configuration
module "database" {
  source = "../../modules/database"

  environment     = local.environment
  vpc_id         = module.networking.vpc_id
  private_subnets = module.networking.private_subnets

  rds_config = {
    instance_class    = "db.r5.xlarge"  # Reduced size for staging
    allocated_storage = 100
    engine_version   = "15.3"
    multi_az         = local.staging_config.multi_az_enabled
    backup_retention = local.staging_config.backup_retention
  }

  tags = local.common_tags
}

# Cache Module - Staging Configuration
module "cache" {
  source = "../../modules/cache"

  environment     = local.environment
  vpc_id         = module.networking.vpc_id
  private_subnets = module.networking.private_subnets

  redis_config = {
    node_type       = "cache.r5.large"  # Reduced size for staging
    num_cache_nodes = local.staging_config.instance_count
    engine_version  = "7.0"
    automatic_failover_enabled = false  # Disabled for staging
  }

  tags = local.common_tags
}

# Monitoring Module - Staging Settings
module "monitoring" {
  source = "../../modules/monitoring"

  environment = local.environment
  
  cloudwatch_config = {
    retention_days = 30  # Reduced retention for staging
    metric_interval = local.staging_config.monitoring_interval
    alarm_namespace = "Memorable/Staging"
  }

  alert_config = {
    sns_topic_name = "memorable-staging-alerts"
    email_endpoints = ["staging-alerts@memorable.com"]
  }

  tags = local.common_tags
}

# Outputs
output "vpc_id" {
  description = "The ID of the staging VPC"
  value       = module.networking.vpc_id
}

output "ecs_cluster_id" {
  description = "The ID of the staging ECS cluster"
  value       = module.compute.ecs_cluster_id
}

output "rds_endpoint" {
  description = "The endpoint of the staging RDS instance"
  value       = module.database.rds_endpoint
  sensitive   = true
}

output "redis_endpoint" {
  description = "The endpoint of the staging Redis cluster"
  value       = module.cache.redis_endpoint
  sensitive   = true
}

output "load_balancer_dns" {
  description = "The DNS name of the staging load balancer"
  value       = module.compute.load_balancer_dns
}