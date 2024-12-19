# Core Database Configuration Variables
variable "environment" {
  description = "Environment name (dev/staging/prod) for resource naming and tagging"
  type        = string
  
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "instance_class" {
  description = "RDS instance class (db.r5.2xlarge as per requirements)"
  type        = string
  default     = "db.r5.2xlarge"
  
  validation {
    condition     = can(regex("^db\\.r5\\.", var.instance_class))
    error_message = "Instance class must be from the r5 family as per requirements."
  }
}

variable "allocated_storage" {
  description = "Allocated storage size in GB for RDS instance"
  type        = number
  default     = 100
  
  validation {
    condition     = var.allocated_storage >= 100
    error_message = "Allocated storage must be at least 100 GB for production workloads."
  }
}

variable "engine_version" {
  description = "PostgreSQL engine version (15+ as per requirements)"
  type        = string
  default     = "15.3"
  
  validation {
    condition     = tonumber(split(".", var.engine_version)[0]) >= 15
    error_message = "PostgreSQL version must be 15 or higher as per requirements."
  }
}

# High Availability Configuration
variable "multi_az" {
  description = "Enable Multi-AZ deployment for high availability"
  type        = bool
  default     = true
}

variable "read_replica_count" {
  description = "Number of read replicas to create for read scaling"
  type        = number
  default     = 2
  
  validation {
    condition     = var.read_replica_count >= 0 && var.read_replica_count <= 5
    error_message = "Read replica count must be between 0 and 5."
  }
}

# Backup and Recovery Configuration
variable "backup_retention_period" {
  description = "Number of days to retain automated backups"
  type        = number
  default     = 35
  
  validation {
    condition     = var.backup_retention_period >= 35
    error_message = "Backup retention period must be at least 35 days for compliance."
  }
}

variable "backup_window" {
  description = "Preferred backup window for automated backups (UTC)"
  type        = string
  default     = "03:00-04:00"
  
  validation {
    condition     = can(regex("^([0-1][0-9]|2[0-3]):[0-5][0-9]-([0-1][0-9]|2[0-3]):[0-5][0-9]$", var.backup_window))
    error_message = "Backup window must be in the format HH:MM-HH:MM."
  }
}

# Network Configuration
variable "subnet_ids" {
  description = "List of subnet IDs for database subnet group"
  type        = list(string)
}

variable "vpc_security_group_ids" {
  description = "List of VPC security group IDs for database access"
  type        = list(string)
}

# Security Configuration
variable "storage_encrypted" {
  description = "Enable storage encryption at rest using KMS"
  type        = bool
  default     = true
}

variable "deletion_protection" {
  description = "Enable deletion protection for production databases"
  type        = bool
  default     = true
}

# Monitoring Configuration
variable "monitoring_interval" {
  description = "Enhanced monitoring interval in seconds"
  type        = number
  default     = 30
  
  validation {
    condition     = contains([0, 1, 5, 10, 15, 30, 60], var.monitoring_interval)
    error_message = "Monitoring interval must be one of: 0, 1, 5, 10, 15, 30, 60."
  }
}

variable "performance_insights_enabled" {
  description = "Enable Performance Insights for monitoring"
  type        = bool
  default     = true
}

variable "performance_insights_retention_period" {
  description = "Retention period for Performance Insights data in days"
  type        = number
  default     = 7
  
  validation {
    condition     = contains([7, 731], var.performance_insights_retention_period)
    error_message = "Performance Insights retention period must be either 7 or 731 days."
  }
}

# Maintenance Configuration
variable "maintenance_window" {
  description = "Preferred maintenance window for database updates (UTC)"
  type        = string
  default     = "sun:04:00-sun:05:00"
  
  validation {
    condition     = can(regex("^[a-z]{3}:[0-9]{2}:[0-9]{2}-[a-z]{3}:[0-9]{2}:[0-9]{2}$", var.maintenance_window))
    error_message = "Maintenance window must be in the format ddd:hh:mm-ddd:hh:mm."
  }
}

variable "auto_minor_version_upgrade" {
  description = "Enable automatic minor version upgrades"
  type        = bool
  default     = true
}

# Database Parameter Group Configuration
variable "parameter_group_family" {
  description = "PostgreSQL parameter group family for database configuration"
  type        = string
  default     = "postgres15"
  
  validation {
    condition     = can(regex("^postgres[0-9]{2}$", var.parameter_group_family))
    error_message = "Parameter group family must match PostgreSQL version (e.g., postgres15)."
  }
}

variable "parameter_group_parameters" {
  description = "Custom parameters for database parameter group"
  type        = map(string)
  default     = {
    "shared_buffers"       = "8GB"
    "max_connections"      = "1000"
    "effective_cache_size" = "24GB"
    "work_mem"            = "64MB"
    "maintenance_work_mem" = "2GB"
    "random_page_cost"    = "1.1"
  }
}

# Tags Configuration
variable "tags" {
  description = "Resource tags for the database infrastructure"
  type        = map(string)
  default     = {}
  
  validation {
    condition     = can(lookup(var.tags, "Environment", null)) && can(lookup(var.tags, "ManagedBy", null))
    error_message = "Tags must include at minimum 'Environment' and 'ManagedBy' keys."
  }
}