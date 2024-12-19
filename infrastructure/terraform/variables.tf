# Environment Configuration
variable "environment" {
  description = "Deployment environment (dev/staging/prod)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

# Region Configuration
variable "aws_region" {
  description = "AWS region for infrastructure deployment"
  type        = string
  validation {
    condition     = can(regex("^(us|eu|ap|sa|ca|me|af)-(north|south|east|west|central)-[1-9]$", var.aws_region))
    error_message = "AWS region must be a valid region identifier."
  }
  default = "us-east-1"
}

# Network Configuration
variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "VPC CIDR must be a valid IPv4 CIDR block."
  }
  default = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "List of availability zones for multi-AZ deployment"
  type        = list(string)
  validation {
    condition     = length(var.availability_zones) >= 3
    error_message = "At least 3 availability zones must be specified for high availability."
  }
}

# Compute Configuration
variable "instance_types" {
  description = "Instance types for different service tiers"
  type = object({
    web_instance_type     = string
    api_instance_type     = string
    service_instance_type = string
  })
  validation {
    condition = (
      can(regex("^t3\\.(large|xlarge|2xlarge)$", var.instance_types.web_instance_type)) &&
      can(regex("^c5\\.(large|xlarge|2xlarge)$", var.instance_types.api_instance_type)) &&
      can(regex("^c5\\.(xlarge|2xlarge|4xlarge)$", var.instance_types.service_instance_type))
    )
    error_message = "Instance types must match the required specifications for each tier."
  }
  default = {
    web_instance_type     = "t3.large"
    api_instance_type     = "c5.xlarge"
    service_instance_type = "c5.2xlarge"
  }
}

# Database Configuration
variable "database_config" {
  description = "RDS database configuration"
  type = object({
    instance_class           = string
    allocated_storage       = number
    engine_version         = string
    backup_retention_period = number
    multi_az               = bool
    maintenance_window     = string
  })
  validation {
    condition = (
      can(regex("^db\\.r5\\.(xlarge|2xlarge|4xlarge)$", var.database_config.instance_class)) &&
      var.database_config.allocated_storage >= 100 &&
      var.database_config.backup_retention_period >= 7
    )
    error_message = "Database configuration must meet production requirements."
  }
  default = {
    instance_class           = "db.r5.2xlarge"
    allocated_storage       = 100
    engine_version         = "15.3"
    backup_retention_period = 7
    multi_az               = true
    maintenance_window     = "Mon:03:00-Mon:04:00"
  }
}

# ElastiCache Configuration
variable "elasticache_config" {
  description = "ElastiCache Redis configuration"
  type = object({
    node_type                = string
    num_cache_nodes         = number
    engine_version          = string
    automatic_failover      = bool
    snapshot_retention_limit = number
  })
  validation {
    condition = (
      can(regex("^cache\\.r5\\.(large|xlarge|2xlarge)$", var.elasticache_config.node_type)) &&
      var.elasticache_config.num_cache_nodes >= 2
    )
    error_message = "ElastiCache configuration must meet high availability requirements."
  }
  default = {
    node_type                = "cache.r5.xlarge"
    num_cache_nodes         = 2
    engine_version          = "7.0"
    automatic_failover      = true
    snapshot_retention_limit = 7
  }
}

# ECS Task Configuration
variable "ecs_task_config" {
  description = "ECS task definitions and health check configuration"
  type = object({
    cpu_units                  = map(number)
    memory_units              = map(number)
    desired_count             = map(number)
    health_check_grace_period = number
  })
  validation {
    condition = (
      sum(values(var.ecs_task_config.cpu_units)) > 0 &&
      sum(values(var.ecs_task_config.memory_units)) > 0 &&
      var.ecs_task_config.health_check_grace_period >= 60
    )
    error_message = "ECS task configuration must specify valid resource allocations."
  }
  default = {
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
}

# Auto Scaling Configuration
variable "autoscaling_config" {
  description = "Auto scaling configuration for ECS services"
  type = object({
    min_capacity       = number
    max_capacity       = number
    cpu_threshold      = number
    memory_threshold   = number
    scale_in_cooldown  = number
    scale_out_cooldown = number
  })
  validation {
    condition = (
      var.autoscaling_config.min_capacity >= 2 &&
      var.autoscaling_config.max_capacity <= 10 &&
      var.autoscaling_config.cpu_threshold <= 75 &&
      var.autoscaling_config.memory_threshold <= 80
    )
    error_message = "Auto scaling configuration must meet production requirements."
  }
  default = {
    min_capacity       = 2
    max_capacity       = 6
    cpu_threshold      = 70
    memory_threshold   = 75
    scale_in_cooldown  = 300
    scale_out_cooldown = 180
  }
}

# Monitoring Configuration
variable "monitoring_config" {
  description = "CloudWatch monitoring and alerting configuration"
  type = object({
    retention_in_days = number
    alarm_email      = string
  })
  validation {
    condition = (
      var.monitoring_config.retention_in_days >= 30 &&
      can(regex("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$", var.monitoring_config.alarm_email))
    )
    error_message = "Monitoring configuration must specify valid retention period and alert email."
  }
  default = {
    retention_in_days = 90
    alarm_email      = "alerts@memorable.com"
  }
}

# Resource Tagging
variable "tags" {
  description = "Resource tags for cost allocation and compliance"
  type        = map(string)
  validation {
    condition     = length(var.tags) >= 3
    error_message = "At least 3 tags must be specified (environment, project, owner)."
  }
  default = {
    environment = "prod"
    project     = "memorable"
    owner       = "platform-team"
    managed-by  = "terraform"
  }
}