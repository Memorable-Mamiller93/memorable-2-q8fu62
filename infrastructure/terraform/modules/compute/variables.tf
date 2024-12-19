# Terraform version constraint
terraform {
  required_version = "~> 1.0"
}

# Environment identifier
variable "environment" {
  description = "Deployment environment identifier (dev/staging/prod)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

# Instance types for different service tiers
variable "instance_types" {
  description = "EC2 instance types for different service tiers"
  type = object({
    web     = string # For web servers
    api     = string # For API servers
    service = string # For service containers
  })
  default = {
    web     = "t3.large"     # 2 vCPU, 8GB RAM
    api     = "c5.xlarge"    # 4 vCPU, 8GB RAM
    service = "c5.2xlarge"   # 8 vCPU, 16GB RAM
  }
  validation {
    condition     = can(regex("^[a-z][0-9][.][a-z]+$", var.instance_types.web))
    error_message = "Instance types must be valid AWS instance type identifiers."
  }
}

# CPU allocation for ECS tasks
variable "ecs_task_cpu" {
  description = "CPU units allocation for ECS tasks (1 CPU = 1024 units)"
  type = object({
    web     = number # Frontend containers
    api     = number # API Gateway containers
    service = number # Service containers
  })
  default = {
    web     = 1024  # 1 vCPU
    api     = 2048  # 2 vCPU
    service = 4096  # 4 vCPU
  }
  validation {
    condition     = alltrue([for v in values(var.ecs_task_cpu) : v >= 256 && v <= 4096])
    error_message = "CPU units must be between 256 and 4096."
  }
}

# Memory allocation for ECS tasks
variable "ecs_task_memory" {
  description = "Memory allocation for ECS tasks in MiB"
  type = object({
    web     = number # Frontend containers
    api     = number # API Gateway containers
    service = number # Service containers
  })
  default = {
    web     = 2048  # 2GB
    api     = 4096  # 4GB
    service = 8192  # 8GB
  }
  validation {
    condition     = alltrue([for v in values(var.ecs_task_memory) : v >= 512 && v <= 16384])
    error_message = "Memory allocation must be between 512 and 16384 MiB."
  }
}

# Desired task count for each service
variable "desired_task_count" {
  description = "Initial number of tasks to run for each service type"
  type = object({
    web     = number
    api     = number
    service = number
  })
  default = {
    web     = 2
    api     = 2
    service = 2
  }
  validation {
    condition     = alltrue([for v in values(var.desired_task_count) : v > 0])
    error_message = "Desired task count must be greater than 0."
  }
}

# Auto-scaling configuration
variable "autoscaling_config" {
  description = "Auto-scaling configuration for ECS services"
  type = object({
    min_capacity      = number
    max_capacity      = number
    cpu_threshold     = number
    memory_threshold  = number
  })
  default = {
    min_capacity      = 1
    max_capacity      = 10
    cpu_threshold     = 70
    memory_threshold  = 85
  }
  validation {
    condition     = var.autoscaling_config.min_capacity <= var.autoscaling_config.max_capacity
    error_message = "Minimum capacity must be less than or equal to maximum capacity."
  }
  validation {
    condition     = var.autoscaling_config.cpu_threshold >= 0 && var.autoscaling_config.cpu_threshold <= 100
    error_message = "CPU threshold must be between 0 and 100."
  }
  validation {
    condition     = var.autoscaling_config.memory_threshold >= 0 && var.autoscaling_config.memory_threshold <= 100
    error_message = "Memory threshold must be between 0 and 100."
  }
}

# VPC configuration
variable "vpc_id" {
  description = "VPC ID for ECS cluster placement"
  type        = string
  validation {
    condition     = can(regex("^vpc-[a-z0-9]+$", var.vpc_id))
    error_message = "VPC ID must be a valid AWS VPC identifier."
  }
}

# Subnet configuration
variable "private_subnet_ids" {
  description = "Private subnet IDs for ECS task placement"
  type        = list(string)
  validation {
    condition     = length(var.private_subnet_ids) >= 2
    error_message = "At least two private subnets must be provided for high availability."
  }
  validation {
    condition     = alltrue([for id in var.private_subnet_ids : can(regex("^subnet-[a-z0-9]+$", id))])
    error_message = "Subnet IDs must be valid AWS subnet identifiers."
  }
}

# Security group configuration
variable "security_group_ids" {
  description = "Security group IDs for ECS tasks"
  type        = list(string)
  validation {
    condition     = alltrue([for id in var.security_group_ids : can(regex("^sg-[a-z0-9]+$", id))])
    error_message = "Security group IDs must be valid AWS security group identifiers."
  }
}

# Resource tagging
variable "tags" {
  description = "Resource tags for cost allocation and management"
  type        = map(string)
  default = {
    Terraform   = "true"
    Environment = "dev"
    Project     = "memorable"
  }
}

# Container insights configuration
variable "enable_container_insights" {
  description = "Toggle for ECS container insights monitoring"
  type        = bool
  default     = true
}