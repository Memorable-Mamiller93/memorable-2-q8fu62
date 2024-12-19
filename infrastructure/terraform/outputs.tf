# Network Infrastructure Outputs
output "vpc_id" {
  description = "ID of the VPC where the Memorable platform is deployed"
  value       = module.networking.vpc_id
}

output "public_subnet_ids" {
  description = "List of public subnet IDs for ALB and public-facing resources"
  value       = module.networking.public_subnet_ids
}

output "private_subnet_ids" {
  description = "List of private subnet IDs for application and database resources"
  value       = module.networking.private_subnet_ids
}

output "network_security_details" {
  description = "Network security configuration details including VPC flow logs and NAT gateway status"
  value       = module.networking.network_security_details
  sensitive   = true
}

# Compute Infrastructure Outputs
output "ecs_cluster_id" {
  description = "ID of the ECS cluster for service deployments"
  value       = module.compute.ecs_cluster_id
}

output "ecs_cluster_name" {
  description = "Name of the ECS cluster for service configurations"
  value       = module.compute.ecs_cluster_name
}

output "ecs_task_execution_role_arn" {
  description = "ARN of the ECS task execution role for container permissions"
  value       = module.compute.ecs_task_execution_role_arn
}

output "load_balancer_dns" {
  description = "DNS name of the application load balancer"
  value       = module.compute.load_balancer_dns
}

# Database Infrastructure Outputs
output "primary_db_endpoint" {
  description = "Endpoint URL for the primary PostgreSQL database"
  value       = module.database.primary_db_endpoint
  sensitive   = true
}

output "read_replica_endpoints" {
  description = "List of endpoint URLs for PostgreSQL read replicas"
  value       = module.database.read_replica_endpoints
  sensitive   = true
}

output "database_security_group_id" {
  description = "ID of the security group controlling database access"
  value       = module.database.database_security_group_id
}

output "database_subnet_group_name" {
  description = "Name of the database subnet group"
  value       = module.database.database_subnet_group_name
}

# Monitoring and Logging Outputs
output "cloudwatch_log_groups" {
  description = "Map of CloudWatch Log Group names for different components"
  value = {
    ecs_cluster = module.compute.cloudwatch_log_group_name
    vpc_flow_logs = module.networking.flow_logs_config.log_group_name
    database_logs = module.database.cloudwatch_log_group_name
  }
}

output "monitoring_configuration" {
  description = "Configuration details for monitoring and alerting"
  value = {
    performance_insights_enabled = module.database.performance_insights_enabled
    enhanced_monitoring_role_arn = module.database.monitoring_role_arn
    container_insights_enabled   = true
  }
}

# Security and Compliance Outputs
output "kms_key_arns" {
  description = "ARNs of KMS keys used for encryption"
  value = {
    database = module.database.kms_key_arn
  }
  sensitive = true
}

output "security_group_ids" {
  description = "Map of security group IDs for different components"
  value = {
    database = module.database.database_security_group_id
    ecs_tasks = module.compute.ecs_security_group_id
    load_balancer = module.compute.alb_security_group_id
  }
}

# Resource Tags
output "resource_tags" {
  description = "Common resource tags applied across all components"
  value = {
    Environment = var.environment
    Project     = "Memorable"
    ManagedBy   = "Terraform"
  }
}

# Availability Zones
output "availability_zones" {
  description = "List of availability zones used in the deployment"
  value       = module.networking.availability_zones
}