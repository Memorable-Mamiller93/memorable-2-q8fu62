# Provider Configuration
# AWS Provider v5.0+
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
    encrypt = true
  }

  required_version = ">= 1.5.0"
}

# Provider Configuration with Enhanced Security
provider "aws" {
  region = var.aws_region
  
  assume_role {
    role_arn     = var.assume_role_arn
    session_name = "TerraformDeployment-${var.environment}"
  }

  default_tags {
    tags = local.common_tags
  }
}

# Enhanced Local Variables
locals {
  name_prefix = "memorable-${var.environment}"
  
  common_tags = {
    Environment        = var.environment
    Project           = "Memorable"
    ManagedBy         = "Terraform"
    SecurityCompliance = "PCI-DSS"
    DataClassification = "Sensitive"
    BackupRetention   = "30days"
  }

  monitoring_tags = {
    MonitoringLevel   = "Enhanced"
    AlertingThreshold = "Critical"
    RetentionPeriod   = "90days"
  }
}

# Random Resource Names
resource "random_id" "unique" {
  byte_length = 8
}

# Networking Module - Multi-AZ Infrastructure
module "networking" {
  source = "./modules/networking"

  environment         = var.environment
  vpc_cidr           = var.vpc_cidr
  availability_zones = var.availability_zones
  
  tags = merge(local.common_tags, {
    NetworkTier = "Production"
  })
}

# Security Module - Enhanced Security Controls
module "security" {
  source = "./modules/security"

  vpc_id             = module.networking.vpc_id
  environment        = var.environment
  private_subnets    = module.networking.private_subnets
  
  tags = merge(local.common_tags, {
    SecurityLevel = "High"
  })
}

# Database Module - RDS PostgreSQL
module "database" {
  source = "./modules/database"

  vpc_id             = module.networking.vpc_id
  subnet_ids         = module.networking.database_subnets
  security_group_ids = [module.security.database_security_group_id]
  
  instance_class     = var.database_config.instance_class
  allocated_storage = var.database_config.allocated_storage
  engine_version    = var.database_config.engine_version
  
  backup_retention_period = var.database_config.backup_retention_period
  multi_az               = var.database_config.multi_az
  maintenance_window     = var.database_config.maintenance_window

  tags = merge(local.common_tags, {
    Service = "Database"
  })
}

# Cache Module - Redis Cluster
module "elasticache" {
  source = "./modules/elasticache"

  vpc_id             = module.networking.vpc_id
  subnet_ids         = module.networking.elasticache_subnets
  security_group_ids = [module.security.elasticache_security_group_id]
  
  node_type                = var.elasticache_config.node_type
  num_cache_nodes         = var.elasticache_config.num_cache_nodes
  engine_version          = var.elasticache_config.engine_version
  automatic_failover      = var.elasticache_config.automatic_failover
  snapshot_retention_limit = var.elasticache_config.snapshot_retention_limit

  tags = merge(local.common_tags, {
    Service = "Cache"
  })
}

# ECS Cluster Module
module "ecs" {
  source = "./modules/ecs"

  vpc_id             = module.networking.vpc_id
  private_subnets    = module.networking.private_subnets
  public_subnets     = module.networking.public_subnets
  security_group_ids = [module.security.ecs_security_group_id]
  
  web_instance_type     = var.instance_types.web_instance_type
  api_instance_type     = var.instance_types.api_instance_type
  service_instance_type = var.instance_types.service_instance_type
  
  task_config = var.ecs_task_config
  autoscaling_config = var.autoscaling_config

  tags = merge(local.common_tags, {
    Service = "ECS"
  })
}

# Monitoring Module - Enhanced Observability
module "monitoring" {
  source = "./modules/monitoring"

  environment        = var.environment
  retention_in_days = var.monitoring_config.retention_in_days
  alarm_email       = var.monitoring_config.alarm_email
  
  vpc_id            = module.networking.vpc_id
  ecs_cluster_name  = module.ecs.cluster_name
  rds_instance_id   = module.database.instance_id
  
  tags = merge(local.common_tags, local.monitoring_tags)
}

# CDN Module - CloudFront Distribution
module "cdn" {
  source = "./modules/cdn"

  environment = var.environment
  alb_dns_name = module.ecs.alb_dns_name
  
  tags = merge(local.common_tags, {
    Service = "CDN"
  })
}

# Outputs
output "vpc_id" {
  description = "VPC ID with enhanced network security configuration"
  value       = module.networking.vpc_id
}

output "rds_endpoint" {
  description = "Encrypted RDS endpoint for secure application configuration"
  value       = module.database.endpoint
  sensitive   = true
}

output "elasticache_endpoint" {
  description = "Secured ElastiCache endpoint for application configuration"
  value       = module.elasticache.endpoint
  sensitive   = true
}

output "alb_dns_name" {
  description = "Load balancer DNS with WAF and SSL configuration"
  value       = module.ecs.alb_dns_name
}

output "cloudfront_domain" {
  description = "CloudFront distribution domain name"
  value       = module.cdn.domain_name
}

output "monitoring_dashboard_url" {
  description = "CloudWatch dashboard URL for infrastructure monitoring"
  value       = module.monitoring.dashboard_url
}