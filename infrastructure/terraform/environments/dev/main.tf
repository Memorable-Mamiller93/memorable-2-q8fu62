# Development Environment Terraform Configuration
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

  # Enhanced State Management with Encryption and Locking
  backend "s3" {
    bucket         = "memorable-terraform-dev-state"
    key            = "dev/terraform.tfstate"
    region         = var.region
    encrypt        = true
    dynamodb_table = "memorable-terraform-dev-locks"
    
    # Development-specific versioning and lifecycle
    versioning     = true
    lifecycle {
      prevent_destroy = true
    }
  }
}

# Development AWS Provider Configuration
provider "aws" {
  region      = var.region
  profile     = "dev"
  
  # Enhanced retry configuration for development
  retry_mode  = "adaptive"
  max_retries = 5

  default_tags {
    tags = local.common_tags
  }
}

# Development Environment Local Variables
locals {
  environment = "dev"
  
  # Enhanced tagging strategy for development
  common_tags = {
    Environment     = "dev"
    Project         = "Memorable"
    ManagedBy      = "Terraform"
    CostCenter     = "Development"
    AutoShutdown   = "true"
    DataRetention  = "30days"
    SecurityLevel  = "development"
  }

  # Development-specific resource naming
  name_prefix = "memorable-${local.environment}"
}

# Root Module Configuration with Development Overrides
module "root_module" {
  source = "../../main.tf"

  # Development-specific variable overrides
  environment = local.environment
  aws_region  = var.region
  vpc_cidr    = var.vpc_cidr

  # Development instance types
  instance_types = {
    web_instance_type     = "t3.large"     # Development sizing
    api_instance_type     = "c5.xlarge"    # Development sizing
    service_instance_type = "c5.2xlarge"   # Development sizing
  }

  # Development database configuration
  database_config = {
    instance_class           = "db.t3.large"  # Development sizing
    allocated_storage       = 50             # Reduced for development
    engine_version         = "15.3"
    backup_retention_period = 7              # Development retention
    multi_az               = false          # Single AZ for development
    maintenance_window     = "Mon:03:00-Mon:04:00"
  }

  # Development cache configuration
  elasticache_config = {
    node_type                = "cache.t3.medium"  # Development sizing
    num_cache_nodes         = 1                  # Single node for development
    engine_version          = "7.0"
    automatic_failover      = false              # Disabled for development
    snapshot_retention_limit = 3                  # Reduced retention
  }

  # Development ECS configuration
  ecs_task_config = {
    cpu_units = {
      web     = 1024
      api     = 2048
      service = 4096
    }
    memory_units = {
      web     = 2048
      api     = 4096
      service = 8192
    }
    desired_count = {
      web     = 1
      api     = 1
      service = 1
    }
    health_check_grace_period = 60
  }

  # Development auto-scaling configuration
  autoscaling_config = {
    min_capacity       = 1
    max_capacity       = 3
    cpu_threshold      = 80
    memory_threshold   = 85
    scale_in_cooldown  = 180
    scale_out_cooldown = 120
  }

  # Development monitoring configuration
  monitoring_config = {
    retention_in_days = 30
    alarm_email      = "dev-alerts@memorable.com"
  }

  tags = local.common_tags
}

# Development-specific outputs
output "vpc_id" {
  description = "Development VPC ID"
  value       = module.root_module.vpc_id
}

output "rds_endpoint" {
  description = "Development RDS endpoint"
  value       = module.root_module.rds_endpoint
  sensitive   = true
}

output "elasticache_endpoint" {
  description = "Development ElastiCache endpoint"
  value       = module.root_module.elasticache_endpoint
  sensitive   = true
}

# Development-specific cost optimization
resource "aws_autoscaling_schedule" "night_shutdown" {
  scheduled_action_name  = "night-shutdown"
  min_size              = 0
  max_size              = 0
  desired_capacity      = 0
  recurrence           = "0 20 * * 1-5"  # 8 PM on weekdays
  autoscaling_group_name = module.root_module.ecs_asg_name
}

resource "aws_autoscaling_schedule" "morning_startup" {
  scheduled_action_name  = "morning-startup"
  min_size              = 1
  max_size              = 3
  desired_capacity      = 1
  recurrence           = "0 8 * * 1-5"   # 8 AM on weekdays
  autoscaling_group_name = module.root_module.ecs_asg_name
}

# Development environment lifecycle hook
resource "aws_autoscaling_lifecycle_hook" "termination_hook" {
  name                   = "dev-termination-hook"
  autoscaling_group_name = module.root_module.ecs_asg_name
  lifecycle_transition   = "autoscaling:EC2_INSTANCE_TERMINATING"
  default_result        = "CONTINUE"
  heartbeat_timeout     = 300

  notification_metadata = jsonencode({
    environment = "development"
    purpose     = "graceful-shutdown"
  })
}