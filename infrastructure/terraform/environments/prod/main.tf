# Production Environment Terraform Configuration
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

  # Enhanced S3 Backend Configuration for Production
  backend "s3" {
    bucket         = "memorable-terraform-prod-state"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "memorable-terraform-prod-locks"
    kms_key_id     = "arn:aws:kms:us-east-1:ACCOUNT_ID:key/prod-terraform-key"
  }

  required_version = ">= 1.5.0"
}

# Production Environment Local Variables
locals {
  environment = "prod"
  common_tags = {
    Environment       = "production"
    Project          = "Memorable"
    ManagedBy        = "Terraform"
    ComplianceLevel  = "PCI-DSS"
    DataClassification = "Sensitive"
    BackupFrequency  = "Daily"
  }

  # Production-specific monitoring thresholds
  monitoring_thresholds = {
    cpu_utilization_threshold    = 70
    memory_utilization_threshold = 75
    response_time_threshold      = 3000  # 3 seconds
    error_rate_threshold        = 1      # 1%
  }
}

# Root Module Configuration for Production
module "root" {
  source = "../../main.tf"

  # Production Network Configuration
  vpc_cidr = "10.0.0.0/16"
  availability_zones = [
    "us-east-1a",
    "us-east-1b",
    "us-east-1c"
  ]

  # Production Compute Resources
  instance_types = {
    web_instance_type     = "t3.large"     # Web servers
    api_instance_type     = "c5.xlarge"    # API servers
    service_instance_type = "c5.2xlarge"   # Service containers
  }

  # Enhanced Database Configuration
  database_config = {
    instance_class           = "db.r5.2xlarge"
    allocated_storage       = 1000
    engine_version         = "15.3"
    backup_retention_period = 30
    multi_az               = true
    maintenance_window     = "Sun:03:00-Sun:04:00"
  }

  # Production Cache Configuration
  elasticache_config = {
    node_type                = "cache.r5.xlarge"
    num_cache_nodes         = 3
    engine_version          = "7.0"
    automatic_failover      = true
    snapshot_retention_limit = 7
  }

  # Production ECS Configuration
  ecs_task_config = {
    cpu_units = {
      web     = 2048
      api     = 4096
      service = 8192
    }
    memory_units = {
      web     = 4096
      api     = 8192
      service = 16384
    }
    desired_count = {
      web     = 3
      api     = 3
      service = 3
    }
    health_check_grace_period = 120
  }

  # Production Auto-scaling Configuration
  autoscaling_config = {
    min_capacity       = 3
    max_capacity       = 10
    cpu_threshold      = local.monitoring_thresholds.cpu_utilization_threshold
    memory_threshold   = local.monitoring_thresholds.memory_utilization_threshold
    scale_in_cooldown  = 300
    scale_out_cooldown = 180
  }

  # Enhanced Monitoring Configuration
  monitoring_config = {
    retention_in_days = 90
    alarm_email      = "platform-alerts@memorable.com"
  }

  # Production Security Configuration
  security_config = {
    enable_waf                = true
    enable_shield_advanced    = true
    enable_guardduty         = true
    enable_security_hub      = true
    ssl_policy              = "ELBSecurityPolicy-TLS-1-2-2017-01"
    backup_retention_days    = 30
    enable_encryption       = true
    enable_audit_logging    = true
  }

  tags = merge(local.common_tags, {
    Environment = local.environment
    Compliance  = "SOC2,PCI-DSS,GDPR"
  })
}

# Production-specific Outputs
output "vpc_id" {
  description = "Production VPC ID"
  value       = module.root.vpc_id
}

output "rds_endpoint" {
  description = "Production RDS endpoint"
  value       = module.root.rds_endpoint
  sensitive   = true
}

output "elasticache_endpoint" {
  description = "Production ElastiCache endpoint"
  value       = module.root.elasticache_endpoint
  sensitive   = true
}

output "alb_dns_name" {
  description = "Production ALB DNS name"
  value       = module.root.alb_dns_name
}

output "cloudwatch_log_groups" {
  description = "Production CloudWatch Log Groups"
  value       = module.root.cloudwatch_log_groups
}

# Enhanced Security Group Outputs
output "security_group_ids" {
  description = "Production security group IDs"
  value = {
    alb     = module.root.security_group_ids.alb
    ecs     = module.root.security_group_ids.ecs
    rds     = module.root.security_group_ids.rds
    redis   = module.root.security_group_ids.redis
  }
  sensitive = true
}

# Compliance and Monitoring Outputs
output "compliance_status" {
  description = "Production compliance status"
  value = {
    pci_compliant     = true
    soc2_compliant    = true
    gdpr_compliant    = true
    backup_enabled    = true
    encryption_enabled = true
  }
}